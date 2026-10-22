import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAIProvider } from "../src/ai/index";
import { isDailyQuota, isTransient } from "../src/ai/retry";
import { ProfileSchema } from "../src/schema/profile";

// Snapshot/restore the env vars createAIProvider reads, so each case starts clean.
const AI_ENV = [
  "AI_PROVIDER",
  "AI_API_KEY",
  "AI_MODEL",
  "AI_BASE_URL",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
] as const;

describe("createAIProvider — BYOK header exfiltration guard (#28)", () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = {};
    for (const k of AI_ENV) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of AI_ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("ignores a client-supplied provider when the request brings no key", () => {
    // Only the server env key exists. A request asking for `openai` + an attacker
    // baseURL but no key must NOT redirect the env key — it falls back to Gemini.
    process.env.GEMINI_API_KEY = "server-gemini-key";
    const p = createAIProvider({
      provider: "openai",
      baseURL: "https://attacker.example/v1",
      model: "x",
    });
    expect(p.name).toBe("gemini");
  });

  it("never pairs the env key with a client-chosen baseURL", () => {
    process.env.AI_PROVIDER = "openai";
    process.env.AI_API_KEY = "server-openai-key";
    process.env.AI_MODEL = "server-model";
    const p = createAIProvider({ baseURL: "https://attacker.example/v1" });
    // No client key → the attacker baseURL must be dropped, not used with our key.
    expect((p as unknown as { baseURL: string }).baseURL).not.toContain("attacker");
  });

  it("honors a client baseURL only when the client also supplies its own key", () => {
    const p = createAIProvider({
      apiKey: "user-key",
      provider: "openai",
      baseURL: "https://my-own-proxy.example/v1",
      model: "x",
    });
    expect((p as unknown as { baseURL: string }).baseURL).toBe("https://my-own-proxy.example/v1");
  });
});

describe("retry classification (#34)", () => {
  it("treats daily-quota exhaustion as non-retryable", () => {
    expect(isDailyQuota(new Error("You exceeded your quota, limit: per day"))).toBe(true);
    expect(isDailyQuota(new Error("429 too many requests this minute"))).toBe(false);
  });

  it("classifies transient status via a numeric err.status when present", () => {
    expect(isTransient(Object.assign(new Error("upstream"), { status: 502 }))).toBe(true);
    expect(isTransient(Object.assign(new Error("bad body mentions 429"), { status: 400 }))).toBe(
      false,
    );
  });
});

describe("ProfileSchema tolerates null leaves from the model (#34)", () => {
  it("parses null string fields instead of throwing", () => {
    const p = ProfileSchema.parse({ basics: { name: "Ada", email: null, phone: null } });
    expect(p.basics.name).toBe("Ada");
  });
});
