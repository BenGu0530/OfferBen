// Type-only re-exports from the shared core. Using `export type` guarantees the
// server-only core runtime (which imports the Gemini SDK) is NEVER bundled into
// client components.
export type {
  Profile,
  Basics,
  Work,
  Education,
  Skill,
  Project,
  Job,
  ParsedJob,
  MatchResult,
  TailoredResume,
  ReferralQA,
  ReferralQAItem,
  LetterKind,
  AppData,
  ApplicationRecord,
  ApplicationStatus,
} from "@offerben/core";

// Local copy of the status list (a runtime value). Defined here rather than
// imported from core so the client bundle never pulls in core's server runtime.
export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "interviewing",
  "rejected",
  "offer",
] as const;

export type LetterOrQAKind =
  | "coverLetter"
  | "recruiterEmail"
  | "referralNote"
  | "referralQA";
