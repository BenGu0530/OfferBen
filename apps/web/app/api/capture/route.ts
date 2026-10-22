import { createAIProvider, extractJobFromImage } from "@offerben/core";
import { aiConfigFromHeaders, jsonHandler } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  /** base64 PNG/JPEG of the visible page (no data: prefix). */
  imageBase64?: string;
  mimeType?: string;
}

export const POST = jsonHandler<Body>(async (body, req) => {
  if (!body.imageBase64) throw new Error("No screenshot provided.");
  // Bound the payload so a malicious/oversized image can't exhaust memory.
  // 12M base64 chars ≈ 9MB decoded.
  if (typeof body.imageBase64 !== "string" || body.imageBase64.length > 12_000_000) {
    throw new Error("Image too large or missing.");
  }
  const ai = createAIProvider(aiConfigFromHeaders(req));
  const job = await extractJobFromImage(ai, {
    mimeType: body.mimeType || "image/png",
    data: body.imageBase64,
  });
  return { job };
});
