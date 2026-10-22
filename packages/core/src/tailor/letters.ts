import type { AIProvider } from "../ai/provider";
import type { CompanyBrief } from "../schema/company";
import type { Job } from "../schema/job";
import type { Profile } from "../schema/profile";
import {
  ReferralQASchema,
  type LetterKind,
  type ReferralQA,
} from "../schema/generation";
import { briefIsUseful } from "../company/research";
import { compact, compactProfile } from "../util/object";

const SYSTEM =
  "You are a sharp career writer. You write in the candidate's authentic voice, concise and " +
  "specific, with zero corporate fluff or clichés. Everything you write is grounded in the " +
  "candidate's real profile.";

// Appended to SYSTEM whenever we have a company brief. The whole point of the
// research step is specificity, so the model is told to spend a paragraph on it
// — and told just as firmly that a fact not in the brief doesn't exist. A letter
// that confidently names the wrong product is worse than a vague one.
const GROUNDING =
  "You are given a COMPANY brief compiled from the company's own website. Use it to be " +
  "concrete: name their actual products, platforms and technologies as the brief names them. " +
  "Never state a fact about the company that is not in the brief or the job description — no " +
  "invented product names, customers, funding, headcount, or numbers. If the brief is thin, " +
  "stay specific about the ROLE instead of padding with adjectives about the company.";

interface LetterSpec {
  label: string;
  instructions: string;
}

const SPECS: Record<LetterKind, LetterSpec> = {
  coverLetter: {
    label: "cover letter",
    instructions:
      "Write a tailored cover letter (~280-350 words, 4 short paragraphs):\n" +
      "1. A hook that names something the company actually builds — a specific product, platform " +
      "or technology from the brief — and says why it interests this candidate.\n" +
      "2-3. Connect 2-3 of the candidate's most relevant achievements to the job's needs. Where a " +
      "project maps onto their product or stack, say so explicitly ('X, which is the same problem " +
      "your Y solves').\n" +
      "4. A confident, brief call to action.\n" +
      "Banned: 'innovative', 'cutting-edge', 'passionate', 'excited about the opportunity', and any " +
      "sentence that would still be true if you swapped in a different company's name.",
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
  /** Optional notes from the company's own site (see company/research.ts). */
  company?: CompanyBrief | null;
}

export async function writeLetter(
  ai: AIProvider,
  { profile, job, kind, company }: LetterInput,
): Promise<string> {
  const spec = SPECS[kind];
  const grounded = briefIsUseful(company);
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
    ...(grounded
      ? [
          "",
          `=== COMPANY (from ${company!.website || "their website"}) ===`,
          // `sources` is provenance for the UI, not context for the writer.
          JSON.stringify(compact({ ...company!, sources: [] })),
        ]
      : []),
    "",
    "=== CANDIDATE PROFILE (JSON) ===",
    JSON.stringify(compactProfile(profile)),
  ].join("\n");

  return ai.generateText({
    system: grounded ? `${SYSTEM} ${GROUNDING}` : SYSTEM,
    prompt,
    temperature: 0.6,
  });
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
