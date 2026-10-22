import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyProposal,
  emptyLibrary,
  LibrarySchema,
  ProposalSchema,
  proposeFromFile,
  type AIProvider,
  type Library,
} from "@offerben/core";
import type { DraftRecord, FileRecord, InboxFile } from "@/lib/types";

/**
 * Local, file-based library store (server only). Everything lives under
 * OFFERBEN_HOME (default ~/OfferBen), OUTSIDE the repo so personal data never
 * ends up in git:
 *
 *   library.json        the library (source of truth)
 *   library.prev.json   the previous version (one-step undo for a bad merge)
 *   state.json          processed-file index + pending drafts
 *   inbox/              drop anything here (Finder, AirDrop, a synced Drive folder)
 *   files/<sha256>.ext  originals, content-addressed — each file costs AI once
 */

export const HOME = process.env.OFFERBEN_HOME || path.join(os.homedir(), "OfferBen");
const P = {
  library: path.join(HOME, "library.json"),
  prev: path.join(HOME, "library.prev.json"),
  state: path.join(HOME, "state.json"),
  inbox: path.join(HOME, "inbox"),
  files: path.join(HOME, "files"),
};

/** Gemini inline-data limit is ~20 MB per request; leave room for the prompt. */
const MAX_INLINE_BYTES = 18 * 1024 * 1024;

const TYPES: Record<string, { mime: string; text?: boolean }> = {
  ".pdf": { mime: "application/pdf" },
  ".png": { mime: "image/png" },
  ".jpg": { mime: "image/jpeg" },
  ".jpeg": { mime: "image/jpeg" },
  ".webp": { mime: "image/webp" },
  ".heic": { mime: "image/heic" },
  ".heif": { mime: "image/heif" },
  ".txt": { mime: "text/plain", text: true },
  ".md": { mime: "text/markdown", text: true },
  ".tex": { mime: "text/x-tex", text: true },
  ".bib": { mime: "text/plain", text: true },
  ".csv": { mime: "text/csv", text: true },
};

interface State {
  files: Record<string, FileRecord>;
  drafts: DraftRecord[];
}

// One write at a time across every route bundle in this process (Next may load
// this module once per route, so the lock lives on globalThis).
const g = globalThis as { __offerbenLibraryLock?: Promise<unknown> };
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__offerbenLibraryLock ?? Promise.resolve();
  const run = prev.then(fn, fn);
  g.__offerbenLibraryLock = run.catch(() => undefined);
  return run;
}

async function ensureDirs() {
  await fs.mkdir(P.inbox, { recursive: true });
  await fs.mkdir(P.files, { recursive: true });
}

/** Write via temp file + rename, so a crash never leaves half a JSON file. */
async function writeAtomic(file: string, data: string) {
  const tmp = `${file}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`;
  await fs.writeFile(tmp, data, "utf8");
  await fs.rename(tmp, file);
}

async function readJson(file: string): Promise<unknown | null> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
  try {
    return JSON.parse(raw);
  } catch {
    // Never silently replace a file we can't read — that would be data loss.
    throw new Error(`${file} is not valid JSON. Fix or move it; OfferBen won't overwrite it.`);
  }
}

export async function readLibrary(): Promise<Library> {
  await ensureDirs();
  const raw = await readJson(P.library);
  return raw ? LibrarySchema.parse(raw) : emptyLibrary();
}

async function writeLibrary(lib: Library): Promise<Library> {
  const clean = LibrarySchema.parse({ ...lib, updatedAt: new Date().toISOString() });
  try {
    await fs.copyFile(P.library, P.prev);
  } catch {
    /* first save: nothing to back up */
  }
  await writeAtomic(P.library, JSON.stringify(clean, null, 2));
  return clean;
}

async function readState(): Promise<State> {
  const raw = (await readJson(P.state)) as Partial<State> | null;
  return { files: raw?.files ?? {}, drafts: raw?.drafts ?? [] };
}

const writeState = (s: State) => writeAtomic(P.state, JSON.stringify(s, null, 2));

export function saveLibrary(lib: Library): Promise<Library> {
  return locked(async () => {
    await ensureDirs();
    return writeLibrary(lib);
  });
}

export async function listInbox(): Promise<InboxFile[]> {
  await ensureDirs();
  const names = await fs.readdir(P.inbox);
  const out: InboxFile[] = [];
  for (const name of names.sort()) {
    if (name.startsWith(".")) continue;
    const st = await fs.stat(path.join(P.inbox, name)).catch(() => null);
    if (!st?.isFile()) continue;
    const t = TYPES[path.extname(name).toLowerCase()];
    out.push({
      name,
      size: st.size,
      supported: Boolean(t) && st.size <= MAX_INLINE_BYTES,
      reason: !t
        ? "unsupported type"
        : st.size > MAX_INLINE_BYTES
          ? "larger than 18 MB"
          : undefined,
    });
  }
  return out;
}

export async function readLibraryState(): Promise<State> {
  await ensureDirs();
  return readState();
}

/** Save uploaded files into the inbox (never overwriting an existing file). */
export async function saveUploads(files: { name: string; base64: string }[]): Promise<string[]> {
  await ensureDirs();
  const saved: string[] = [];
  for (const f of files) {
    const base =
      path
        .basename(String(f.name || "file"))
        .replace(/[^\w.\- ()]/g, "_")
        .slice(0, 120) || "file";
    const ext = path.extname(base);
    const stem = base.slice(0, base.length - ext.length);
    let name = base;
    for (
      let i = 2;
      await fs.stat(path.join(P.inbox, name)).then(
        () => true,
        () => false,
      );
      i++
    ) {
      name = `${stem} (${i})${ext}`;
    }
    await fs.writeFile(path.join(P.inbox, name), Buffer.from(String(f.base64 || ""), "base64"));
    saved.push(name);
  }
  return saved;
}

export interface ProcessResult {
  processed: { name: string; status: string; error?: string }[];
  stoppedReason?: string;
}

/**
 * Turn up to `max` inbox files into drafts (one AI call each). A file already
 * seen (same sha256) is filed away without another call. A failed call leaves
 * the file in the inbox so the next click retries it.
 */
export function processInbox(ai: AIProvider, max: number): Promise<ProcessResult> {
  return locked(async () => {
    const lib = await readLibrary();
    const state = await readState();
    const inbox = await listInbox();
    const result: ProcessResult = { processed: [] };
    let calls = 0;

    for (const item of inbox) {
      if (!item.supported) continue;
      if (calls >= max) break;
      const src = path.join(P.inbox, item.name);
      const buf = await fs.readFile(src);
      const hash = createHash("sha256").update(buf).digest("hex");
      const ext = path.extname(item.name).toLowerCase();
      const t = TYPES[ext];
      const dest = path.join(P.files, `${hash}${ext}`);

      if (state.files[hash]?.status === "processed") {
        // Same content already in the library: file it, no AI call.
        await fs.rename(src, dest).catch(() => fs.unlink(src));
        result.processed.push({ name: item.name, status: "duplicate" });
        continue;
      }

      calls++;
      try {
        const proposal = await proposeFromFile(ai, {
          library: lib,
          fileName: item.name,
          ...(t.text
            ? { text: buf.toString("utf8") }
            : { file: { mimeType: t.mime, data: buf.toString("base64") } }),
        });
        await fs.rename(src, dest);
        state.files[hash] = {
          hash,
          name: item.name,
          mime: t.mime,
          size: item.size,
          ext,
          addedAt: new Date().toISOString(),
          status: "processed",
        };
        state.drafts.push({
          id: randomUUID().slice(0, 8),
          fileHash: hash,
          fileName: item.name,
          fileMime: t.mime,
          createdAt: new Date().toISOString(),
          proposal: ProposalSchema.parse(proposal),
        });
        result.processed.push({ name: item.name, status: "draft" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.processed.push({ name: item.name, status: "failed", error: msg });
        // Quota / auth problems will fail every remaining file too — stop early.
        if (/quota|API key|busy|429|403|401/i.test(msg)) {
          result.stoppedReason = msg;
          break;
        }
      } finally {
        await writeState(state);
      }
    }
    return result;
  });
}

export function resolveDraft(
  draftId: string,
  action: "apply" | "discard",
  accept: number[] = [],
  notes: Record<number, string> = {},
): Promise<{ library: Library; log: string[] }> {
  return locked(async () => {
    const state = await readState();
    const draft = state.drafts.find((d) => d.id === draftId);
    if (!draft) throw new Error("That draft no longer exists.");
    let lib = await readLibrary();
    let log: string[] = ["Discarded."];
    if (action === "apply") {
      const r = applyProposal(lib, ProposalSchema.parse(draft.proposal), {
        accept,
        notes,
        fileHash: draft.fileHash,
        fileMime: draft.fileMime,
      });
      lib = await writeLibrary(r.library);
      log = r.log;
    }
    state.drafts = state.drafts.filter((d) => d.id !== draftId);
    await writeState(state);
    return { library: lib, log };
  });
}

/** Read a stored original by hash (for photo thumbnails). Hash-only: no path input. */
export async function readStoredFile(hash: string): Promise<{ data: Buffer; mime: string } | null> {
  if (!/^[a-f0-9]{64}$/.test(hash)) return null;
  const state = await readState();
  const rec = state.files[hash];
  if (!rec) return null;
  const data = await fs.readFile(path.join(P.files, `${hash}${rec.ext}`)).catch(() => null);
  return data ? { data, mime: rec.mime } : null;
}
