import { z } from "zod";
import { ProfileSchema } from "./profile";

/** A resume rewritten/reordered to target a specific job. */
export const TailoredResumeSchema = z.object({
  profile: ProfileSchema,
  /** Keywords that were surfaced/emphasized for this role. */
  emphasis: z.array(z.string()).default([]),
  /** Brief, human-readable notes on what was changed and why. */
  changeNotes: z.array(z.string()).default([]),
});
export type TailoredResume = z.infer<typeof TailoredResumeSchema>;

export const ReferralQAItemSchema = z.object({
  question: z.string().default(""),
  answer: z.string().default(""),
});
export type ReferralQAItem = z.infer<typeof ReferralQAItemSchema>;

export const ReferralQASchema = z.object({
  items: z.array(ReferralQAItemSchema).default([]),
});
export type ReferralQA = z.infer<typeof ReferralQASchema>;

/** The supported one-shot text artifacts. */
export type LetterKind = "coverLetter" | "recruiterEmail" | "referralNote";
