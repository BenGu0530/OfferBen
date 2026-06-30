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
  "gemini-3.5-flash", // separate, lightly-used quota bucket
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  /** Ordered candidates: primary first, then fallbacks. */
  readonly models: string[];
  private client: GoogleGenAI;

  constructor(apiKey: string, model: string = DEFAULT_GEMINI_MODEL, fallbacks = DEFAULT_FALLBACK_MODELS) {
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
          if (!isTransient(err)) throw err;
          if (i < 2) await sleep(400 * 2 ** i); // 0.4s, 0.8s, then move on
        }
      }
    }
    const s = String((lastErr as { message?: string })?.message ?? lastErr);
    if (/not valid JSON|empty response/i.test(s) && !/\b(429|503)\b/.test(s)) {
      throw new Error("The AI couldn't produce a clean result. Try again, or use a cleaner job posting.");
    }
    throw new Error("All AI models are busy or out of quota right now. Please try again in a moment.");
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
      const res = await this.client.models.generateContent({
        model,
        contents: this.buildContents(prompt, opts.files),
        config: {
          ...(opts.system ? { systemInstruction: opts.system } : {}),
          temperature: opts.temperature ?? 0.3,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      return parse(extractJson(res.text ?? ""));
    });
  }
}
