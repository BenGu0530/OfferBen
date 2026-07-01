import type { AIProvider } from "../ai/provider";
import { MatchResultSchema, type MatchResult } from "../schema/match";
import type { Job, ParsedJob } from "../schema/job";
import type { Profile } from "../schema/profile";
import { clamp, compactProfile } from "../util/object";

const SYSTEM =
  "You are a blunt, fair hiring evaluator. You give honest match assessments and never " +
  "inflate scores. You think in terms of what an ATS and a hiring manager would actually do.";

const SCHEMA_HINT = `{
  "score": number (0-100, honest),
  "verdict": string (e.g. "Strong match" | "Worth tailoring" | "Stretch"),
  "summary": string (2-3 sentences),
  "matchedKeywords": [string],
  "missingKeywords": [string],
  "strengths": [string],
  "gaps": [string],
  "suggestions": [string]  // concrete actions to improve this specific application
}`;

export interface ScoreMatchInput {
  profile: Profile;
  job: Job;
  parsed?: ParsedJob;
}

export async function scoreMatch(
  ai: AIProvider,
  { profile, job, parsed }: ScoreMatchInput,
): Promise<MatchResult> {
  const prompt = [
    "Evaluate how well the candidate matches the job. Be honest and specific.",
    "Compare against the job's required skills/keywords. Identify matched vs missing keywords",
    "(use the job's terminology), real strengths, real gaps, and concrete suggestions.",
    "",
    "=== CANDIDATE PROFILE (JSON) ===",
    JSON.stringify(compactProfile(profile)),
    "",
    "=== JOB ===",
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    parsed
      ? `Required: ${parsed.requiredSkills.join(", ")}\nKeywords: ${parsed.keywords.join(", ")}`
      : "",
    "Description:",
    job.description,
  ].join("\n");

  const result = await ai.generateJSON(
    // temperature 0: scoring should be deterministic for the same profile+job,
    // so the score doesn't wobble between the side panel and the web app.
    { system: SYSTEM, prompt, schemaHint: SCHEMA_HINT, temperature: 0 },
    (raw) => MatchResultSchema.parse(raw),
  );

  result.score = Math.round(clamp(result.score, 0, 100));
  return result;
}
