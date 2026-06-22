import type { AIProvider } from "../ai/provider";
import type { Job, ParsedJob } from "../schema/job";
import type { MatchResult } from "../schema/match";
import type { Profile } from "../schema/profile";
import { TailoredResumeSchema, type TailoredResume } from "../schema/generation";
import { compactProfile } from "../util/object";

const SYSTEM =
  "You are an expert resume writer and career coach. You tailor resumes to specific jobs while " +
  "remaining strictly truthful. You write tight, quantified, ATS-friendly bullets.";

const SCHEMA_HINT = `{
  "profile": { ...same schema as the input profile (basics, work, education, skills, projects, certificates, publications, awards, languages)... },
  "emphasis": [string]   // keywords you surfaced for this role,
  "changeNotes": [string] // short bullets describing what you changed and why
}`;

export interface TailorResumeInput {
  profile: Profile;
  job: Job;
  parsed?: ParsedJob;
  match?: MatchResult;
}

export async function tailorResume(
  ai: AIProvider,
  { profile, job, parsed, match }: TailorResumeInput,
): Promise<TailoredResume> {
  const prompt = [
    "Rewrite and reorder the candidate's resume to best fit the target job.",
    "",
    "HARD RULES:",
    "- Never fabricate employers, titles, dates, degrees, certifications, or metrics.",
    "- Only surface skills/keywords the candidate genuinely demonstrates somewhere.",
    "- Keep the same overall schema. Return the FULL profile (every section), not a diff.",
    "",
    "TAILORING:",
    "- Reorder work, projects, and skills so the most relevant items come first.",
    "- Rewrite highlights to lead with impact and weave in the job's terminology naturally.",
    "- Tighten `basics.summary` into a 2-3 sentence pitch aimed at THIS role.",
    "- Keep it ATS-safe: plain bullet text, standard section names, no tables or columns.",
    "",
    "=== TARGET JOB ===",
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    parsed ? `Key requirements: ${parsed.requiredSkills.join(", ")}` : "",
    parsed ? `ATS keywords: ${parsed.keywords.join(", ")}` : "",
    match && match.missingKeywords.length
      ? `Known gaps to address honestly (do NOT fake): ${match.missingKeywords.join(", ")}`
      : "",
    "Description:",
    job.description,
    "",
    "=== CURRENT PROFILE (JSON) ===",
    JSON.stringify(compactProfile(profile)),
  ].join("\n");

  return ai.generateJSON(
    { system: SYSTEM, prompt, schemaHint: SCHEMA_HINT, temperature: 0.4 },
    (raw) => TailoredResumeSchema.parse(raw),
  );
}
