import { DEFAULT_GEMINI_MODEL, GeminiProvider } from "./gemini";
import { OpenAICompatibleProvider } from "./openai";
import type { AIProvider } from "./provider";

export * from "./provider";
export { GeminiProvider, DEFAULT_GEMINI_MODEL } from "./gemini";
export { OpenAICompatibleProvider } from "./openai";
export { extractJson } from "./json";
export { withRetry, isTransient } from "./retry";

/**
 * Build the configured AI provider from environment variables. Call this only
 * on the server — it reads secret env vars.
 *
 * Pick a backend with AI_PROVIDER (default "gemini"):
 *
 *   AI_PROVIDER=gemini   GEMINI_API_KEY=...  [GEMINI_MODEL=gemini-2.5-flash]
 *
 *   AI_PROVIDER=openai   AI_API_KEY=...  AI_MODEL=...  [AI_BASE_URL=...]
 *     └─ works with OpenAI, Groq, OpenRouter, DeepSeek, Ollama, or your own
 *        fine-tuned model behind any OpenAI-compatible server. Swapping models
 *        is an env change — never a code change.
 */
export function createAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

  if (provider === "openai" || provider === "openai-compatible") {
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;
    if (!apiKey) {
      throw new Error("AI_API_KEY is not set. Add it to apps/web/.env.local (see .env.example).");
    }
    if (!model) {
      throw new Error("AI_MODEL is not set (e.g. gpt-4o-mini, llama-3.3-70b-versatile). See .env.example.");
    }
    return new OpenAICompatibleProvider({ apiKey, model, baseURL: process.env.AI_BASE_URL });
  }

  // Default: Gemini.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to apps/web/.env.local (see .env.example).",
    );
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  return new GeminiProvider(apiKey, model);
}
