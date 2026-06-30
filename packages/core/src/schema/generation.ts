import { z } from "zod";
import { ProfileSchema } from "./profile";

/** An experience/project the model left OFF the resume for this role, + why. */
export const DroppedItemSchema = z.object({
  kind: z.enum(["work", "project"]).default("project"),
  title: z.string().default(""),
  reason: z.string().default(""),
});
export type DroppedItem = z.infer<typeof DroppedItemSchema>;

/**
 * A resume CURATED for a specific job: `profile` contains only the experiences
 * and projects worth showing, reordered most-relevant-first and reworded;
 * `dropped` lists what was intentionally left off and why.
 */
export const TailoredResumeSchema = z.object({
  profile: ProfileSchema,
  /** Items deliberately excluded for this role (with rationale). */
  dropped: z.array(DroppedItemSchema).default([]),
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

export const InterviewQASchema = z.object({
  question: z.string().default(""),
  /** "behavioral" | "technical". */
  type: z.string().default("behavioral"),
  /** A draft answer (STAR for behavioral) grounded in the candidate's profile. */
  answer: z.string().default(""),
});
export type InterviewQA = z.infer<typeof InterviewQASchema>;

export const InterviewPrepSchema = z.object({
  items: z.array(InterviewQASchema).default([]),
});
export type InterviewPrep = z.infer<typeof InterviewPrepSchema>;

/** The supported one-shot text artifacts. */
export type LetterKind = "coverLetter" | "recruiterEmail" | "referralNote";
