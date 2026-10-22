import { GoogleGenAI } from "@google/genai";
import type { AIProvider, GenerateJSONOptions, GenerateTextOptions, InlineFile } from "./provider";
import { extractJson } from "./json";
import { isTransient, sleep } from "./retry";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

// When the primary model returns transient 503s (free-tier capacity spikes),
// fall over to these — each is a SEPARATE capacity pool, so a different model is
// often available when one is congested. Deduped against the primary.
const DEFAULT_FALLBACK_MODELS = [
  "gemini-2.0-flash-lite",
  // TODO: re-add once a real 3.x flash id is confirmed (the old "gemini-3.5-flash"
  // id was unverified and permanently killed the fallback chain with a 404).
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

/** Auth failures never recover by retrying or hopping models — surface at once. */
function isAuthError(err: unknown): boolean {
  const s = String((err as { message?: string })?.message ?? err);
  return /\b(401|403)\b|API key|PERMISSION_DENIED|UNAUTHENTICATED/i.test(s);
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  /** Ordered candidates: primary first, then fallbacks. */
  readonly models: string[];
  private client: GoogleGenAI;

  constructor(
    apiKey: string,
    model: string = DEFAULT_GEMINI_MODEL,
    fallbacks = DEFAULT_FALLBACK_MODELS,
  ) {
    if (!apiKey) throw new Error("Gemini API key is required.");
    this.client = new GoogleGenAI({ apiKey });
    this.models = [model, ...fallbacks.filter((m) => m !== model)];
  }

  get model(): string {
    return this.models[0];
  }

  private buildContents(prompt: string, files?: InlineFile[]) {
    const parts: Part[] = [];
    for (const f of files ?? []) {
      parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
    }
    parts.push({ text: prompt });
    return [{ role: "user" as const, parts }];
  }

  /**
   * Run `attempt` against each candidate model in turn. Within a model, retry a
   * few times on transient errors (503/overload, rate-limit, bad JSON); if it
   * keeps failing transiently, fall over to the next model. Non-transient errors
   * (e.g. 400) throw immediately. Only when every model is exhausted do we throw
   * a clean, user-facing message.
   */
  private async runWithModels<T>(attempt: (model: string) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (const model of this.models) {
      for (let i = 0; i < 3; i++) {
        try {
          return await attempt(model);
        } catch (err) {
          lastErr = err;
          // Auth errors won't recover on any model — surface immediately.
          if (isAuthError(err)) throw err;
          // A non-transient error (400/404 from a picky fallback model) must NOT
          // kill the whole chain (#29): fall over to the next model instead. We
          // only re-attempt the SAME model on transient errors; otherwise skip
          // straight to the next candidate.
          if (!isTransient(err)) break;
          if (i < 2) await sleep(400 * 2 ** i); // 0.4s, 0.8s, then move on
        }
      }
    }
    const s = String((lastErr as { message?: string })?.message ?? lastErr);
    if (/not valid JSON|empty response/i.test(s) && !/\b(429|503)\b/.test(s)) {
      throw new Error(
        "The AI couldn't produce a clean result. Try again, or use a cleaner job posting.",
      );
    }
    // The user-facing message is deliberately vague; the real one (which model,
    // which limit) is what you actually need when debugging, so log it. It never
    // contains the API key — the SDK keeps that in the header.
    console.error("[offerben:ai] all models failed:", this.models.join(", "), "|", s);
    throw new Error(
      "All AI models are busy or out of quota right now. Please try again in a moment.",
    );
  }

  async generateText(opts: GenerateTextOptions): Promise<string> {
    const res = await this.runWithModels((model) =>
      this.client.models.generateContent({
        model,
        contents: this.buildContents(opts.prompt, opts.files),
        config: {
          ...(opts.system ? { systemInstruction: opts.system } : {}),
          temperature: opts.temperature ?? 0.6,
        },
      }),
    );
    return (res.text ?? "").trim();
  }

  async generateJSON<T>(opts: GenerateJSONOptions, parse: (raw: unknown) => T): Promise<T> {
    const prompt = opts.schemaHint
      ? `${opts.prompt}\n\nReturn ONLY a single valid JSON value matching this shape (no prose, no markdown):\n${opts.schemaHint}`
      : opts.prompt;

    // `thinkingBudget: 0` disables the flash model's reasoning pass for
    // structured output — faster, and avoids it spending the token budget
    // "thinking" and truncating the JSON.
    return this.runWithModels(async (model) => {
      // Only thinking-capable models (2.5 / 3.x) accept `thinkingConfig`. Sending
      // it to a 2.0 / flash-lite non-thinking model can 400 and (before #29) kill
      // the hop — so compute it per-model and omit it otherwise.
      const supportsThinking = /2\.5|3/.test(model);
      const res = await this.client.models.generateContent({
        model,
        contents: this.buildContents(prompt, opts.files),
        config: {
          ...(opts.system ? { systemInstruction: opts.system } : {}),
          temperature: opts.temperature ?? 0.3,
          responseMimeType: "application/json",
          // why: dense profiles returned whole by tailorResume can exceed the
          // old 8192 cap and truncate the JSON mid-object; 16384 gives headroom.
          maxOutputTokens: 16384,
          ...(supportsThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      });
      return parse(extractJson(res.text ?? ""));
    });
  }
}
