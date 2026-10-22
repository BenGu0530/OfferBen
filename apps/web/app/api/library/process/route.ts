import { createAIProvider } from "@offerben/core";
import { aiConfigFromHeaders, jsonHandler } from "@/lib/server";
import { listInbox, processInbox, readLibraryState } from "@/lib/library/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Organize inbox files into drafts for review. One AI call per NEW file. */
export const POST = jsonHandler<{ max?: number }>(async (body, req) => {
  const max = Math.max(1, Math.min(10, Number(body.max) || 3));
  const ai = createAIProvider(aiConfigFromHeaders(req));
  const result = await processInbox(ai, max);
  const [inbox, state] = await Promise.all([listInbox(), readLibraryState()]);
  return { ...result, inbox, drafts: state.drafts };
});
