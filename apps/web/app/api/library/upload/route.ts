import { jsonHandler } from "@/lib/server";
import { listInbox, saveUploads } from "@/lib/library/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOTAL_BASE64 = 60 * 1024 * 1024; // ~45 MB of files per upload

/** Drag-and-drop from the browser lands in the same inbox as files dropped in Finder. */
export const POST = jsonHandler<{ files?: { name?: string; base64?: string }[] }>(async (body) => {
  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length) throw new Error("No files.");
  const total = files.reduce((n, f) => n + String(f.base64 ?? "").length, 0);
  if (total > MAX_TOTAL_BASE64)
    throw new Error("Too much at once — upload under ~45 MB per batch.");
  const saved = await saveUploads(
    files.map((f) => ({ name: String(f.name ?? "file"), base64: String(f.base64 ?? "") })),
  );
  return { saved, inbox: await listInbox() };
});
