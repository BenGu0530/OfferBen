import { DEFAULT_GEMINI_MODEL, GeminiProvider } from "./gemini";
import { OpenAICompatibleProvider } from "./openai";
import type { AIProvider } from "./provider";

export * from "./provider";
export { GeminiProvider, DEFAULT_GEMINI_MODEL } from "./gemini";
export { OpenAICompatibleProvider } from "./openai";
export { extractJson } from "./json";
export { withRetry, isTransient } from "./retry";

/** Per-request AI config (BYOK). Any field overrides the corresponding env var. */
export interface AIConfig {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseURL?: string;
}

/**
 * Build the AI provider. Call this only on the server.
 *
 * BYOK ("bring your own key"): each user can supply their own provider/key/model
 * (passed per-request, stored only in their browser, never persisted server-side).
 * Anything not provided falls back to env vars, so a self-hoster can just set
 * GEMINI_API_KEY (or AI_*) and skip the UI entirely.
 *
 *   provider "gemini"  -> apiKey + (model)            | env: GEMINI_API_KEY, GEMINI_MODEL
 *   provider "openai"  -> apiKey + model + (baseURL)  | env: AI_API_KEY, AI_MODEL, AI_BASE_URL
 *     └─ "openai" covers OpenAI, Groq, OpenRouter, DeepSeek, Ollama, or your own
 *        fine-tuned model behind any OpenAI-compatible server.
 */
export function createAIProvider(cfg: AIConfig = {}): AIProvider {
  // why (#28): fields must NOT fall back to env independently. A request that
  // supplies `provider`/`baseURL` but NO key of its own would otherwise pair the
  // server's env key with a client-chosen endpoint — exfiltrating our key to an
  // arbitrary host (SSRF-style). Rule: only pair a CLIENT baseURL/provider with a
  // CLIENT key; only pair the ENV key with the ENV provider/baseURL. Never mix.
  // `model` is not a security boundary, so it stays overridable in both cases.
  const usingClientKey = !!cfg.apiKey;
  const provider = (
    (usingClientKey && cfg.provider) ||
    process.env.AI_PROVIDER ||
    "gemini"
  ).toLowerCase();

  if (provider === "openai" || provider === "openai-compatible") {
    const apiKey = cfg.apiKey || process.env.AI_API_KEY;
    const model = cfg.model || process.env.AI_MODEL;
    if (!apiKey) {
      throw new Error(
        "No API key. Add one in Settings (BYOK) or set AI_API_KEY in apps/web/.env.local.",
      );
    }
    if (!model) {
      throw new Error(
        "No model set. Pick one in Settings (e.g. llama-3.3-70b-versatile) or set AI_MODEL.",
      );
    }
    const baseURL = usingClientKey
      ? cfg.baseURL || process.env.AI_BASE_URL
      : process.env.AI_BASE_URL;
    return new OpenAICompatibleProvider({ apiKey, model, baseURL });
  }

  // Default: Gemini.
  const apiKey = cfg.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No Gemini API key. Add one in Settings (BYOK) or set GEMINI_API_KEY in apps/web/.env.local.",
    );
  }
  const model = cfg.model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  return new GeminiProvider(apiKey, model);
}
