import { NextResponse, type NextRequest } from "next/server";

/**
 * The API reads/writes the local library (personal data) and spends the AI key,
 * so it must only answer the person at this machine:
 *  - Host must be loopback: defeats DNS rebinding (a web page re-pointing its own
 *    domain at 127.0.0.1 to read responses same-origin).
 *  - Origin, when present, must be this app or the Chrome extension: blocks
 *    cross-site requests that don't need a CORS preflight.
 * Requests with no Origin (curl, server-to-server) are allowed — they can't come
 * from a web page.
 */
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const OK_ORIGIN =
  /^(https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?|chrome-extension:\/\/[a-p]{32})$/i;

export function middleware(req: NextRequest) {
  if (!LOCAL_HOST.test(req.headers.get("host") ?? "")) {
    return NextResponse.json({ error: "OfferBen only answers on localhost." }, { status: 403 });
  }
  const origin = req.headers.get("origin");
  if (origin && !OK_ORIGIN.test(origin)) {
    return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
