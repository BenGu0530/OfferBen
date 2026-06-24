import { searchAuthors } from "@offerben/core";
import { jsonHandler } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Body {
  name?: string;
  institution?: string;
}

// No AI / no key — pure OpenAlex lookup, so this works even without Gemini quota.
export const POST = jsonHandler<Body>(async (body) => {
  const name = (body.name ?? "").trim();
  if (!name) throw new Error("Enter a name to search.");
  const candidates = await searchAuthors(name, body.institution);
  return { candidates };
});
