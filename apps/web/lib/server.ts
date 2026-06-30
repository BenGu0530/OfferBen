import { NextResponse } from "next/server";
import type { AIConfig } from "@offerben/core";

/**
 * Wrap a route handler so thrown errors become clean JSON responses, and a
 * missing API key produces an actionable message instead of a stack trace.
 * The handler also receives the Request so it can read BYOK headers.
 */
export function jsonHandler<T>(
  fn: (body: T, req: Request) => Promise<unknown>,
): (req: Request) => Promise<NextResponse> {
  return async (req: Request) => {
    let body: T;
    try {
      body = (await req.json()) as T;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    try {
      const result = await fn(body, req);
      return NextResponse.json(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected server error.";
      const status = /API key|out of quota|busy/i.test(message) ? 503 : 500;
      console.error("[offerben:api]", message);
      return NextResponse.json({ error: message }, { status });
    }
  };
}

/**
 * BYOK config from request headers. The user's key lives in their browser and is
 * sent per-request; we use it for that call only and never persist it. Falls back
 * to env vars (so self-hosters who set GEMINI_API_KEY don't need to send anything).
 */
export function aiConfigFromHeaders(req: Request): AIConfig {
  const h = req.headers;
  return {
    provider: h.get("x-offerben-provider") || undefined,
    apiKey: h.get("x-offerben-key") || undefined,
    model: h.get("x-offerben-model") || undefined,
    baseURL: h.get("x-offerben-baseurl") || undefined,
  };
}
