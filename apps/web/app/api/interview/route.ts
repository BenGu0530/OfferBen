import { createAIProvider, JobSchema, ProfileSchema, writeInterviewPrep } from "@offerben/core";
import { aiConfigFromHeaders, jsonHandler } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

interface Body {
  profile: unknown;
  job: unknown;
}

export const POST = jsonHandler<Body>(async (body, req) => {
  const profile = ProfileSchema.parse(body.profile ?? {});
  const job = JobSchema.parse(body.job ?? {});
  if (!job.description.trim()) throw new Error("Add a job description first.");
  const ai = createAIProvider(aiConfigFromHeaders(req));
  const prep = await writeInterviewPrep(ai, { profile, job });
  return { prep };
});
