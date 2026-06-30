import {
  createAIProvider,
  JobSchema,
  ProfileSchema,
  tailorResume,
} from "@offerben/core";
import type { MatchResult, ParsedJob } from "@offerben/core";
import { jsonHandler } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

interface Body {
  profile: unknown;
  job: unknown;
  parsed?: ParsedJob;
  match?: MatchResult;
  pageTarget?: 1 | 2;
}

export const POST = jsonHandler<Body>(async (body) => {
  const profile = ProfileSchema.parse(body.profile ?? {});
  const job = JobSchema.parse(body.job ?? {});
  const ai = createAIProvider();
  const resume = await tailorResume(ai, {
    profile,
    job,
    parsed: body.parsed,
    match: body.match,
    pageTarget: body.pageTarget === 1 ? 1 : 2,
  });
  return { resume };
});
