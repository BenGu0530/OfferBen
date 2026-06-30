"use client";

/**
 * BYOK ("bring your own key") settings, stored only in this browser. The key is
 * sent per-request as a header to our own API route, used for that call, and
 * never persisted server-side. Leave it empty to fall back to the server's env
 * key (the self-host path).
 */
export interface AISettings {
  provider: "gemini" | "openai";
  apiKey: string;
  model: string;
  baseURL: string;
}

const KEY = "offerben.ai.v1";

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: "gemini",
  apiKey: "",
  model: "",
  baseURL: "",
};

export function loadAISettings(): AISettings {
  if (typeof window === "undefined") return DEFAULT_AI_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_AI_SETTINGS, ...(JSON.parse(raw) as Partial<AISettings>) } : DEFAULT_AI_SETTINGS;
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAISettings(s: AISettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

/** Headers carrying the user's BYOK config (only the fields they've set). */
export function aiHeaders(): Record<string, string> {
  const s = loadAISettings();
  const h: Record<string, string> = {};
  if (s.apiKey) {
    h["x-offerben-provider"] = s.provider;
    h["x-offerben-key"] = s.apiKey;
    if (s.model) h["x-offerben-model"] = s.model;
    if (s.provider === "openai" && s.baseURL) h["x-offerben-baseurl"] = s.baseURL;
  }
  return h;
}

/** Short label for the active backend (for the header chip). */
export function activeModelLabel(): string {
  const s = loadAISettings();
  if (!s.apiKey) return "Server key";
  const model = s.model || (s.provider === "gemini" ? "gemini" : "model");
  return `BYOK · ${model}`;
}
