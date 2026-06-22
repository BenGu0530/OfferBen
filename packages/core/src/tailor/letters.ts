import type { AIProvider } from "../ai/provider";
import type { Job } from "../schema/job";
import type { Profile } from "../schema/profile";
import {
  ReferralQASchema,
  type LetterKind,
  type ReferralQA,
} from "../schema/generation";
import { compactProfile } from "../util/object";

const SYSTEM =
  "You are a sharp career writer. You write in the candidate's authentic voice, concise and " +
  "specific, with zero corporate fluff or clichés. Everything you write is grounded in the " +
  "candidate's real profile.";

interface LetterSpec {
  label: string;
  instructions: string;
}

const SPECS: Record<LetterKind, LetterSpec> = {
  coverLetter: {
    label: "cover letter",
    instructions:
      "Write a tailored cover letter (~250-320 words, 3-4 short paragraphs). Open with a specific " +
      "hook tied to the company/role, connect 2-3 of the candidate's most relevant achievements to " +
      "the job's needs, and close with a confident call to action. No generic filler.",
  },
  recruiterEmail: {
    label: "recruiter outreach email",
    instructions:
      "Write a short cold email to a recruiter (<140 words) expressing interest in the role. " +
      "Include a one-line hook, two crisp proof points, and a clear ask. Provide a subject line on " +
      "the first line as `Subject: ...`.",
  },
  referralNote: {
    label: "LinkedIn referral note",
    instructions:
      "Write a brief, friendly LinkedIn message (<110 words) asking a current employee for a referral. " +
      "Be respectful of their time, mention the specific role, and give one compelling reason you'd be " +
      "a strong fit. Make it easy for them to say yes.",
  },
};

export interface LetterInput {
  profile: Profile;
  job: Job;
  kind: LetterKind;
}

export async function writeLetter(
  ai: AIProvider,
  { profile, job, kind }: LetterInput,
): Promise<string> {
  const spec = SPECS[kind];
  const prompt = [
    `Write a ${spec.label} for this application.`,
    spec.instructions,
    "Output only the text itself (no markdown headings, no commentary).",
    "",
    "=== JOB ===",
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    "Description:",
    job.description,
    "",
    "=== CANDIDATE PROFILE (JSON) ===",
    JSON.stringify(compactProfile(profile)),
  ].join("\n");

  return ai.generateText({ system: SYSTEM, prompt, temperature: 0.6 });
}

export interface ReferralQAInput {
  profile: Profile;
  job: Job;
}

export async function writeReferralQA(
  ai: AIProvider,
  { profile, job }: ReferralQAInput,
): Promise<ReferralQA> {
  const prompt = [
    "An employee willing to refer the candidate often asks a few questions first.",
    "Generate 4-6 likely referral questions and strong, truthful draft answers grounded in the",
    "candidate's profile and this role (e.g. why this company, relevant experience, availability,",
    "visa/work authorization if implied). Keep answers 2-4 sentences.",
    "",
    "=== JOB ===",
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    job.description,
    "",
    "=== CANDIDATE PROFILE (JSON) ===",
    JSON.stringify(compactProfile(profile)),
  ].join("\n");

  return ai.generateJSON(
    {
      system: SYSTEM,
      prompt,
      schemaHint: `{ "items": [{ "question": string, "answer": string }] }`,
      temperature: 0.5,
    },
    (raw) => ReferralQASchema.parse(raw),
  );
}
