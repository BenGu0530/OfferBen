import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Short-lived handoff store for the extension → web app job pass.
 * The extension POSTs the captured job here and gets back a tiny id; it then
 * opens `/?h=<id>`. This keeps the JD out of the URL — putting the full base64
 * JD in the query string overflowed the request header limit (HTTP 431).
 *
 * In-memory + TTL: fine for the local dev server (single process). A hosted API
 * (issue #13) would swap this for a real short-lived store.
 */
const store = new Map<string, { job: unknown; t: number }>();
const TTL_MS = 10 * 60 * 1000;

function gc() {
  const now = Date.now();
  for (const [k, v] of store) if (now - v.t > TTL_MS) store.delete(k);
}

export async function POST(req: Request) {
  let body: { job?: unknown };
  try {
    body = (await req.json()) as { job?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.job) return NextResponse.json({ error: "No job provided." }, { status: 400 });
  gc();
  const id = crypto.randomUUID().slice(0, 12);
  store.set(id, { job: body.job, t: Date.now() });
  return NextResponse.json({ id });
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const entry = store.get(id);
  if (!entry) return NextResponse.json({ error: "Handoff expired or not found." }, { status: 404 });
  return NextResponse.json({ job: entry.job });
}
