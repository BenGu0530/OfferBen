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
} from "@offerben/core";

export type LetterOrQAKind =
  | "coverLetter"
  | "recruiterEmail"
  | "referralNote"
  | "referralQA";
