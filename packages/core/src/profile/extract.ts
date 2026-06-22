import type { AIProvider, InlineFile } from "../ai/provider";
import { ProfileSchema, type Profile } from "../schema/profile";

const SYSTEM =
  "You are a meticulous resume parser. You extract structured data exactly as written. " +
  "You never invent employers, dates, titles, degrees, or skills that are not present in the source.";

const SCHEMA_HINT = `{
  "basics": {
    "name": string, "label": string (headline/title), "email": string, "phone": string,
    "url": string, "summary": string,
    "location": { "city": string, "region": string, "countryCode": string },
    "profiles": [{ "network": string (e.g. LinkedIn/GitHub), "username": string, "url": string }]
  },
  "work": [{ "name": string (company), "position": string, "location": string,
             "startDate": "YYYY-MM", "endDate": "YYYY-MM" | "Present",
             "summary": string, "highlights": [string] }],
  "education": [{ "institution": string, "area": string, "studyType": string,
                  "startDate": string, "endDate": string, "score": string, "courses": [string] }],
  "skills": [{ "name": string (group, e.g. "Languages"), "keywords": [string] }],
  "projects": [{ "name": string, "description": string, "url": string,
                 "highlights": [string], "keywords": [string] }],
  "certificates": [{ "name": string, "issuer": string, "date": string, "url": string }],
  "publications": [{ "name": string, "publisher": string, "releaseDate": string, "url": string, "summary": string }],
  "awards": [{ "title": string, "date": string, "awarder": string, "summary": string }],
  "languages": [{ "language": string, "fluency": string }]
}`;

export interface ExtractProfileInput {
  /** Pasted resume / LinkedIn text. */
  text?: string;
  /** An uploaded file (e.g. resume PDF) as base64. */
  file?: InlineFile;
}

export async function extractProfile(
  ai: AIProvider,
  input: ExtractProfileInput,
): Promise<Profile> {
  if (!input.text && !input.file) {
    throw new Error("Provide resume text or a file to extract a profile.");
  }

  const prompt = [
    `Extract a complete, structured candidate profile from the following ${input.file ? "resume document" : "resume / profile text"}.`,
    "Guidelines:",
    "- Group skills into sensible categories.",
    "- Keep each work/project highlight a single concise, achievement-oriented bullet.",
    "- Preserve dates as written; use \"Present\" for current roles.",
    "- Use empty strings/arrays for anything not present. Do not guess.",
    input.text ? `\n--- SOURCE ---\n${input.text}\n--- END SOURCE ---` : "",
  ].join("\n");

  return ai.generateJSON(
    {
      system: SYSTEM,
      prompt,
      schemaHint: SCHEMA_HINT,
      files: input.file ? [input.file] : undefined,
      temperature: 0.15,
    },
    (raw) => ProfileSchema.parse(raw),
  );
}
