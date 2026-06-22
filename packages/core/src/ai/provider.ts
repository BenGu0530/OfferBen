/**
 * Provider-agnostic AI interface. The rest of the codebase depends only on this,
 * so Gemini can be swapped for OpenAI/Anthropic/a local model without touching
 * any business logic.
 */

export interface InlineFile {
  /** e.g. "application/pdf" */
  mimeType: string;
  /** base64-encoded file contents */
  data: string;
}

export interface GenerateTextOptions {
  /** System instruction / persona. */
  system?: string;
  prompt: string;
  files?: InlineFile[];
  temperature?: number;
}

export interface GenerateJSONOptions extends GenerateTextOptions {
  /** A textual description / example of the expected JSON shape. */
  schemaHint?: string;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;

  generateText(opts: GenerateTextOptions): Promise<string>;

  /**
   * Generate JSON and validate/coerce it with the provided `parse` function
   * (typically a Zod `schema.parse`).
   */
  generateJSON<T>(opts: GenerateJSONOptions, parse: (raw: unknown) => T): Promise<T>;
}
