import { createAIProvider, getAuthorDossier, synthesizeResearchTaste } from "@offerben/core";
import { aiConfigFromHeaders, jsonHandler } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  authorId?: string;
  /** Skip the LLM taste synthesis (e.g. when out of quota) and return data only. */
  skipTaste?: boolean;
}

export const POST = jsonHandler<Body>(async (body, req) => {
  if (!body.authorId) throw new Error("Pick a person first.");
  const dossier = await getAuthorDossier(body.authorId);

  // The dossier (school/labs/publications) needs no AI. Taste synthesis does —
  // if it fails (e.g. quota), still return the dossier so the data is useful.
  if (body.skipTaste) return { dossier, taste: null };
  try {
    const taste = await synthesizeResearchTaste(createAIProvider(aiConfigFromHeaders(req)), dossier);
    return { dossier, taste };
  } catch (err) {
    return { dossier, taste: null, tasteError: err instanceof Error ? err.message : "Taste unavailable." };
  }
});
