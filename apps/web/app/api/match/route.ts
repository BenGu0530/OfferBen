import {
  createAIProvider,
  JobSchema,
  parseJob,
  ProfileSchema,
  scoreMatch,
} from "@offerben/core";
import { jsonHandler } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  profile: unknown;
  job: unknown;
}

export const POST = jsonHandler<Body>(async (body) => {
  const profile = ProfileSchema.parse(body.profile ?? {});
  const job = JobSchema.parse(body.job ?? {});
  if (!job.description.trim()) {
    throw new Error("Add a job description first.");
  }
  const ai = createAIProvider();
  const parsed = await parseJob(ai, job);
  const match = await scoreMatch(ai, { profile, job, parsed });
  return { parsed, match };
});
