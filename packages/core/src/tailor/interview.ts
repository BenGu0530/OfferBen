import type { AIProvider } from "../ai/provider";
import type { Job } from "../schema/job";
import type { Profile } from "../schema/profile";
import { InterviewPrepSchema, type InterviewPrep } from "../schema/generation";
import { compactProfile } from "../util/object";

const SYSTEM =
  "You are an interview coach. You predict the questions a candidate will likely face for a " +
  "specific role and draft strong, truthful answers grounded in their actual background. " +
  "Behavioral answers use the STAR structure (Situation, Task, Action, Result).";

const SCHEMA_HINT = `{
  "items": [
    { "question": string, "type": "behavioral" | "technical", "answer": string }
  ]
}`;

export interface InterviewPrepInput {
  profile: Profile;
  job: Job;
}

export async function writeInterviewPrep(
  ai: AIProvider,
  { profile, job }: InterviewPrepInput,
): Promise<InterviewPrep> {
  const prompt = [
    "Predict 6 likely interview questions for this candidate + role (mix behavioral and technical),",
    "and draft a strong answer for each, grounded ONLY in the candidate's real experience.",
    "- Behavioral: use STAR; pull from the candidate's actual projects/work.",
    "- Technical: target the role's required skills; keep answers concrete, not hand-wavy.",
    "- Never invent experience the candidate doesn't have.",
    "",
    "=== TARGET JOB ===",
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    "Description:",
    job.description,
    "",
    "=== CANDIDATE PROFILE (JSON) ===",
    JSON.stringify(compactProfile(profile)),
  ].join("\n");

  return ai.generateJSON(
    { system: SYSTEM, prompt, schemaHint: SCHEMA_HINT, temperature: 0.4 },
    (raw) => InterviewPrepSchema.parse(raw),
  );
}
