import type {
  AIProvider,
  GenerateJSONOptions,
  GenerateTextOptions,
} from "./provider";
import { extractJson } from "./json";
import { withRetry } from "./retry";

/**
 * Provider for ANY OpenAI-compatible Chat Completions endpoint. One class,
 * dozens of backends — just point `baseURL` at the service:
 *
 *   OpenAI     https://api.openai.com/v1
 *   Groq       https://api.groq.com/openai/v1        (generous free tier)
 *   OpenRouter https://openrouter.ai/api/v1          (many free models)
 *   DeepSeek   https://api.deepseek.com/v1
 *   Ollama     http://localhost:11434/v1             (fully local, no key)
 *   <your own fine-tuned model served behind an OpenAI-compatible server>
 *
 * This is the "swap away from Gemini" path: changing models is an env-var
 * change, never a code change.
 */

interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
}

type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image_url"; image_url: { url: string } };
type Message =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "user"; content: Array<TextContent | ImageContent> };

export class OpenAICompatibleProvider implements AIProvider {
  readonly name = "openai-compatible";
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseURL: string;

  constructor({ apiKey, model, baseURL }: OpenAIConfig) {
    if (!apiKey) throw new Error("An API key is required for the OpenAI-compatible provider.");
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = (baseURL || "https://api.openai.com/v1").replace(/\/+$/, "");
  }

  private buildMessages(opts: GenerateTextOptions): Message[] {
    const messages: Message[] = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });

    if (opts.files?.length) {
      // Multimodal content: text + inline images as data URLs. (PDFs are not
      // universally supported across OpenAI-compatible backends.)
      const content: Array<TextContent | ImageContent> = [{ type: "text", text: opts.prompt }];
      for (const f of opts.files) {
        if (f.mimeType.startsWith("image/")) {
          content.push({ type: "image_url", image_url: { url: `data:${f.mimeType};base64,${f.data}` } });
        } else {
          throw new Error(
            `This provider can't read ${f.mimeType} files. Paste the text instead, or use Gemini for PDF parsing.`,
          );
        }
      }
      messages.push({ role: "user", content });
    } else {
      messages.push({ role: "user", content: opts.prompt });
    }
    return messages;
  }

  private async chat(messages: Message[], temperature: number, json: boolean): Promise<string> {
    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`AI request failed (${res.status}). ${detail.slice(0, 300)}`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return (data.choices?.[0]?.message?.content ?? "").trim();
  }

  async generateText(opts: GenerateTextOptions): Promise<string> {
    const messages = this.buildMessages(opts);
    return withRetry(() => this.chat(messages, opts.temperature ?? 0.6, false));
  }

  async generateJSON<T>(opts: GenerateJSONOptions, parse: (raw: unknown) => T): Promise<T> {
    const prompt = opts.schemaHint
      ? `${opts.prompt}\n\nReturn ONLY a single valid JSON value matching this shape (no prose, no markdown):\n${opts.schemaHint}`
      : opts.prompt;
    const messages = this.buildMessages({ ...opts, prompt });
    return withRetry(async () => {
      const text = await this.chat(messages, opts.temperature ?? 0.3, true);
      return parse(extractJson(text));
    });
  }
}
