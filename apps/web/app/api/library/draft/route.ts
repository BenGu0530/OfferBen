import { libraryToProfile } from "@offerben/core";
import { jsonHandler } from "@/lib/server";
import { readLibraryState, resolveDraft } from "@/lib/library/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  draftId?: string;
  action?: "apply" | "discard";
  accept?: number[];
  notes?: Record<string, string>;
}

/** Apply the ops the user ticked (or discard the draft). No AI. */
export const POST = jsonHandler<Body>(async (body) => {
  if (!body.draftId) throw new Error("Missing draftId.");
  const action = body.action === "discard" ? "discard" : "apply";
  const accept = (Array.isArray(body.accept) ? body.accept : [])
    .map(Number)
    .filter(Number.isInteger);
  const notes: Record<number, string> = {};
  for (const [k, v] of Object.entries(body.notes ?? {}))
    if (typeof v === "string" && v.trim()) notes[Number(k)] = v.slice(0, 1000);
  const { library, log } = await resolveDraft(body.draftId, action, accept, notes);
  const state = await readLibraryState();
  return { library, profile: libraryToProfile(library), log, drafts: state.drafts };
});
