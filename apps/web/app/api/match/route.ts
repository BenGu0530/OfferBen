import {
  createAIProvider,
  JobSchema,
  ProfileSchema,
  scoreMatch,
} from "@offerben/core";
import { aiConfigFromHeaders, jsonHandler } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  profile: unknown;
  job: unknown;
}

export const POST = jsonHandler<Body>(async (body, req) => {
  const profile = ProfileSchema.parse(body.profile ?? {});
  const job = JobSchema.parse(body.job ?? {});
  if (!job.description.trim()) {
    throw new Error("Add a job description first.");
  }
  const ai = createAIProvider(aiConfigFromHeaders(req));
  // Single AI call (was 2: parseJob + scoreMatch). The match result already
  // surfaces matched/missing keywords, so we synthesize a lightweight ParsedJob
  // from it for the downstream tailor step instead of spending a 2nd request —
  // important on Gemini's stingy free tier.
  const match = await scoreMatch(ai, { profile, job });
  const parsed = {
    title: job.title,
    company: job.company,
    summary: match.summary ?? "",
    responsibilities: [],
    requiredSkills: match.missingKeywords ?? [],
    niceToHaveSkills: [],
    qualifications: [],
    keywords: [...(match.matchedKeywords ?? []), ...(match.missingKeywords ?? [])],
  };
  return { parsed, match };
});
