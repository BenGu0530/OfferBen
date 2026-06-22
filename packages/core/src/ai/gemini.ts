import { GoogleGenAI } from "@google/genai";
import type {
  AIProvider,
  GenerateJSONOptions,
  GenerateTextOptions,
  InlineFile,
} from "./provider";
import { extractJson } from "./json";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  readonly model: string;
  private client: GoogleGenAI;

  constructor(apiKey: string, model: string = DEFAULT_GEMINI_MODEL) {
    if (!apiKey) throw new Error("Gemini API key is required.");
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  private buildContents(prompt: string, files?: InlineFile[]) {
    const parts: Part[] = [];
    for (const f of files ?? []) {
      parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
    }
    parts.push({ text: prompt });
    return [{ role: "user" as const, parts }];
  }

  async generateText(opts: GenerateTextOptions): Promise<string> {
    const res = await this.client.models.generateContent({
      model: this.model,
      contents: this.buildContents(opts.prompt, opts.files),
      config: {
        ...(opts.system ? { systemInstruction: opts.system } : {}),
        temperature: opts.temperature ?? 0.6,
      },
    });
    return (res.text ?? "").trim();
  }

  async generateJSON<T>(
    opts: GenerateJSONOptions,
    parse: (raw: unknown) => T,
  ): Promise<T> {
    const prompt = opts.schemaHint
      ? `${opts.prompt}\n\nReturn ONLY a single valid JSON value matching this shape (no prose, no markdown):\n${opts.schemaHint}`
      : opts.prompt;

    const res = await this.client.models.generateContent({
      model: this.model,
      contents: this.buildContents(prompt, opts.files),
      config: {
        ...(opts.system ? { systemInstruction: opts.system } : {}),
        temperature: opts.temperature ?? 0.3,
        responseMimeType: "application/json",
      },
    });

    const raw = extractJson(res.text ?? "");
    return parse(raw);
  }
}
