import { createAIProvider, extractProfile } from "@offerben/core";
import { jsonHandler } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  text?: string;
  fileBase64?: string;
  mimeType?: string;
}

export const POST = jsonHandler<Body>(async (body) => {
  if (!body.text?.trim() && !body.fileBase64) {
    throw new Error("Paste your resume text or upload a file first.");
  }
  const ai = createAIProvider();
  const profile = await extractProfile(ai, {
    text: body.text,
    file: body.fileBase64
      ? { mimeType: body.mimeType || "application/pdf", data: body.fileBase64 }
      : undefined,
  });
  return { profile };
});
