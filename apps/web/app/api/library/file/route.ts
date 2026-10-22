import { NextResponse } from "next/server";
import { readStoredFile } from "@/lib/library/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serve a stored original (photo thumbnails). Addressed by sha256 only — no paths. */
export async function GET(req: Request) {
  const h = new URL(req.url).searchParams.get("h") ?? "";
  const f = await readStoredFile(h);
  if (!f) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return new NextResponse(new Uint8Array(f.data), {
    headers: {
      "content-type": f.mime,
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
