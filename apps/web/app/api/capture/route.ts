import { createAIProvider, extractJobFromImage } from "@offerben/core";
import { jsonHandler } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  /** base64 PNG/JPEG of the visible page (no data: prefix). */
  imageBase64?: string;
  mimeType?: string;
}

export const POST = jsonHandler<Body>(async (body) => {
  if (!body.imageBase64) throw new Error("No screenshot provided.");
  const ai = createAIProvider();
  const job = await extractJobFromImage(ai, {
    mimeType: body.mimeType || "image/png",
    data: body.imageBase64,
  });
  return { job };
});
