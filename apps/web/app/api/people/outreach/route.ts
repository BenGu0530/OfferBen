import { createAIProvider, ProfileSchema, writePersonOutreach } from "@offerben/core";
import type { AuthorDossier, OutreachKind, ResearchTaste } from "@offerben/core";
import { aiConfigFromHeaders, jsonHandler } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  profile: unknown;
  person?: AuthorDossier;
  taste?: ResearchTaste | null;
  kind?: OutreachKind;
}

export const POST = jsonHandler<Body>(async (body, req) => {
  if (!body.person?.name) throw new Error("Pick a researched person first.");
  const profile = ProfileSchema.parse(body.profile ?? {});
  const ai = createAIProvider(aiConfigFromHeaders(req));
  const text = await writePersonOutreach(ai, {
    profile,
    person: body.person,
    taste: body.taste,
    kind: body.kind === "research" ? "research" : "referral",
  });
  return { text };
});
