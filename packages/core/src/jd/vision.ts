import { z } from "zod";
import type { AIProvider, InlineFile } from "../ai/provider";

/**
 * Vision fallback for job capture: when DOM parsing fails (heavy-JS sites like
 * LinkedIn, canvas-rendered pages, odd ATS layouts), read a *screenshot* of the
 * page the user is already viewing. This is a robustness fallback, not a
 * scraping shortcut — the capture stays user-initiated and single-page.
 */

const CapturedJobSchema = z.object({
  title: z.string().default(""),
  company: z.string().default(""),
  description: z.string().default(""),
});
export type CapturedJob = z.infer<typeof CapturedJobSchema>;

const SYSTEM =
  "You read a screenshot of a job posting and extract the role exactly as shown. " +
  "Only report what is visible; never invent details.";

const SCHEMA_HINT = `{
  "title": string,        // the job title
  "company": string,      // the hiring company
  "description": string   // the full job description / requirements text visible in the image
}`;

export async function extractJobFromImage(
  ai: AIProvider,
  file: InlineFile,
): Promise<CapturedJob> {
  return ai.generateJSON(
    {
      system: SYSTEM,
      prompt:
        "Extract the job title, company, and the full job description text visible in this screenshot of a careers page.",
      files: [file],
      schemaHint: SCHEMA_HINT,
      temperature: 0.1,
    },
    (raw) => CapturedJobSchema.parse(raw),
  );
}
