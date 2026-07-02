import { z } from "zod";
import { ProfileSchema } from "./profile";

/** A section item the model left OFF the resume for this role, + why. The model
 *  sometimes drops publications/awards/etc. too, so `kind` accepts any section
 *  name and `.catch` coerces anything unexpected to "other" — a stray label must
 *  never fail the whole parse. Only work/project are re-addable in the editor. */
export const DroppedItemSchema = z.object({
  kind: z
    .enum(["work", "project", "publication", "award", "education", "skill", "certificate", "language", "other"])
    .catch("other"),
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
