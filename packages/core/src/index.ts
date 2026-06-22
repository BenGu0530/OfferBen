// Schemas & types
export * from "./schema/index";

// AI provider abstraction + factory
export * from "./ai/index";

// Operations
export { extractProfile, type ExtractProfileInput } from "./profile/extract";
export { parseJob } from "./jd/parse";
export { scoreMatch, type ScoreMatchInput } from "./match/score";
export { tailorResume, type TailorResumeInput } from "./tailor/resume";
export {
  writeLetter,
  writeReferralQA,
  type LetterInput,
  type ReferralQAInput,
} from "./tailor/letters";

// Utilities
export { clamp, compact, compactProfile } from "./util/object";
