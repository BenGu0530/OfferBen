import {
  createAIProvider,
  JobSchema,
  ProfileSchema,
  writeLetter,
  writeReferralQA,
} from "@offerben/core";
import type { LetterKind } from "@offerben/core";
import { jsonHandler } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  profile: unknown;
  job: unknown;
  kind: LetterKind | "referralQA";
}

export const POST = jsonHandler<Body>(async (body) => {
  const profile = ProfileSchema.parse(body.profile ?? {});
  const job = JobSchema.parse(body.job ?? {});
  const ai = createAIProvider();

  if (body.kind === "referralQA") {
    const qa = await writeReferralQA(ai, { profile, job });
    return { qa };
  }

  const text = await writeLetter(ai, { profile, job, kind: body.kind });
  return { text };
});
