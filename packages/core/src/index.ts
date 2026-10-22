// Schemas & types
export * from "./schema/index";

// AI provider abstraction + factory
export * from "./ai/index";

// Operations
export { extractProfile, type ExtractProfileInput } from "./profile/extract";
export { parseJob } from "./jd/parse";
export {
  researchCompany,
  resolveCompanySite,
  briefIsUseful,
  htmlToText,
  type CompanyResearchInput,
} from "./company/research";
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
export {
  writePersonOutreach,
  type OutreachKind,
  type PersonOutreachInput,
} from "./people/outreach";
export { scoreMatch, type ScoreMatchInput } from "./match/score";
export { tailorResume, type TailorResumeInput } from "./tailor/resume";
export {
  writeLetter,
  writeReferralQA,
  type LetterInput,
  type ReferralQAInput,
} from "./tailor/letters";
export { writeInterviewPrep, type InterviewPrepInput } from "./tailor/interview";

// Library (资料库) + LaTeX resumes built from it
export {
  newId,
  normKey,
  findEntry,
  childrenOf,
  libraryOutline,
  applyProposal,
  removeEntry,
  libraryToProfile,
  type ApplyProposalOptions,
  type ApplyResult,
} from "./library/library";
export { proposeFromFile, type ProposeFromFileInput } from "./library/ingest";
export * from "./resume/doc";
export {
  validateResumeDoc,
  boldJobKeywords,
  trimStep,
  limitBold,
  numbersIn,
  type ValidateResult,
} from "./resume/validate";
export {
  renderResumeTex,
  richText,
  texEscape,
  inlineExtras,
  DENSITY,
  type DensityPreset,
  type RenderOptions,
} from "./resume/latex";
export { planResume, type PlanResumeInput } from "./resume/plan";

// Utilities
export { clamp, compact, compactProfile } from "./util/object";

// Storage backends (local / Google Drive) — provider-agnostic persistence
export * from "./storage/index";
