// Schemas & types
export * from "./schema/index";

// AI provider abstraction + factory
export * from "./ai/index";

// Operations
export { extractProfile, type ExtractProfileInput } from "./profile/extract";
export { parseJob } from "./jd/parse";
export { extractJobFromImage, type CapturedJob } from "./jd/vision";
export {
  searchAuthors,
  getAuthorDossier,
  synthesizeResearchTaste,
  type AuthorCandidate,
  type AuthorDossier,
  type Affiliation,
  type PublicationLite,
  type ResearchTaste,
} from "./people/research";
export { writePersonOutreach, type OutreachKind, type PersonOutreachInput } from "./people/outreach";
export { scoreMatch, type ScoreMatchInput } from "./match/score";
export { tailorResume, type TailorResumeInput } from "./tailor/resume";
export {
  writeLetter,
  writeReferralQA,
  type LetterInput,
  type ReferralQAInput,
} from "./tailor/letters";
export { writeInterviewPrep, type InterviewPrepInput } from "./tailor/interview";

// Utilities
export { clamp, compact, compactProfile } from "./util/object";

// Storage backends (local / Google Drive) — provider-agnostic persistence
export * from "./storage/index";
