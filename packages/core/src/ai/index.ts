import { DEFAULT_GEMINI_MODEL, GeminiProvider } from "./gemini";
import type { AIProvider } from "./provider";

export * from "./provider";
export { GeminiProvider, DEFAULT_GEMINI_MODEL } from "./gemini";
export { extractJson } from "./json";

/**
 * Build the configured AI provider from environment variables.
 * Call this only on the server — it reads secret env vars.
 *
 * GEMINI_API_KEY  (required)
 * GEMINI_MODEL    (optional, defaults to gemini-2.5-flash)
 */
export function createAIProvider(): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to apps/web/.env.local (see .env.example).",
    );
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  return new GeminiProvider(apiKey, model);
}
