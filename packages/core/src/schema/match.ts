import { z } from "zod";

/** Result of comparing a profile against a job (gap analysis + score). */
export const MatchResultSchema = z.object({
  /** 0-100. Clamped by the caller after parsing. */
  score: z.coerce.number().default(0),
  /** Short verdict, e.g. "Strong match", "Worth tailoring", "Stretch". */
  verdict: z.string().default(""),
  summary: z.string().default(""),
  matchedKeywords: z.array(z.string()).default([]),
  missingKeywords: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  /** Concrete, actionable suggestions to improve the application. */
  suggestions: z.array(z.string()).default([]),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;
