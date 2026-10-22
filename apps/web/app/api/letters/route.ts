import {
  CompanyBriefSchema,
  createAIProvider,
  JobSchema,
  ProfileSchema,
  writeLetter,
  writeReferralQA,
} from "@offerben/core";
import type { LetterKind } from "@offerben/core";
import { aiConfigFromHeaders, jsonHandler } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  profile: unknown;
  job: unknown;
  kind: LetterKind | "referralQA";
  /** Optional notes researched from the company's own site. */
  company?: unknown;
}

// Whitelist of valid letter kinds — validated before use so an unknown value
// can't index into the SPECS map inside core (avoids an opaque runtime crash).
const LETTER_KINDS: readonly LetterKind[] = ["coverLetter", "recruiterEmail", "referralNote"];

export const POST = jsonHandler<Body>(async (body, req) => {
  const profile = ProfileSchema.parse(body.profile ?? {});
  const job = JobSchema.parse(body.job ?? {});
  const ai = createAIProvider(aiConfigFromHeaders(req));

  if (body.kind === "referralQA") {
    const qa = await writeReferralQA(ai, { profile, job });
    return { qa };
  }

  if (!LETTER_KINDS.includes(body.kind as LetterKind)) {
    throw new Error("Unknown letter kind: " + body.kind);
  }

  // A malformed brief must not sink the letter — drop it and write ungrounded.
  const parsedCompany = body.company ? CompanyBriefSchema.safeParse(body.company) : null;
  const company = parsedCompany?.success ? parsedCompany.data : null;

  const text = await writeLetter(ai, { profile, job, kind: body.kind, company });
  return { text };
});
