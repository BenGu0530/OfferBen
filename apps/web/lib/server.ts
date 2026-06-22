import { NextResponse } from "next/server";

/**
 * Wrap a route handler so thrown errors become clean JSON responses, and a
 * missing API key produces an actionable message instead of a stack trace.
 */
export function jsonHandler<T>(
  fn: (body: T) => Promise<unknown>,
): (req: Request) => Promise<NextResponse> {
  return async (req: Request) => {
    let body: T;
    try {
      body = (await req.json()) as T;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    try {
      const result = await fn(body);
      return NextResponse.json(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected server error.";
      const status = /GEMINI_API_KEY/.test(message) ? 503 : 500;
      console.error("[offerben:api]", message);
      return NextResponse.json({ error: message }, { status });
    }
  };
}
