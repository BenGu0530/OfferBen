import type { AIProvider } from "../ai/provider";
import { ParsedJobSchema, type Job, type ParsedJob } from "../schema/job";

const SYSTEM =
  "You are an expert technical recruiter and ATS analyst. You distill job descriptions into " +
  "the structured signals that matter for screening and resume tailoring.";

const SCHEMA_HINT = `{
  "title": string, "company": string, "seniority": string,
  "summary": string (1-2 sentences),
  "responsibilities": [string],
  "requiredSkills": [string],
  "niceToHaveSkills": [string],
  "qualifications": [string],
  "keywords": [string]  // the exact ATS keywords/technologies worth optimizing for
}`;

export async function parseJob(ai: AIProvider, job: Job): Promise<ParsedJob> {
  if (!job.description.trim()) {
    throw new Error("Job description is empty.");
  }

  const prompt = [
    "Analyze this job posting and extract the structured fields below.",
    "Focus the `keywords` list on concrete, screenable terms (technologies, methods, domains)",
    "that an ATS or recruiter would search for. Deduplicate and keep them short.",
    "",
    `TITLE: ${job.title || "(unknown)"}`,
    `COMPANY: ${job.company || "(unknown)"}`,
    "",
    "--- JOB DESCRIPTION ---",
    job.description,
    "--- END ---",
  ].join("\n");

  return ai.generateJSON(
    { system: SYSTEM, prompt, schemaHint: SCHEMA_HINT, temperature: 0.2 },
    (raw) => ParsedJobSchema.parse(raw),
  );
}
