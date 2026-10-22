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
  DroppedItem,
  ReferralQA,
  ReferralQAItem,
  InterviewPrep,
  InterviewQA,
  LetterKind,
  AppData,
  ApplicationRecord,
  ApplicationStatus,
  AuthorCandidate,
  AuthorDossier,
  Affiliation,
  PublicationLite,
  ResearchTaste,
  OutreachKind,
  Library,
  LibraryEntry,
  LibraryBasics,
  Fact,
  Media,
  SkillGroup,
  Contact,
  EntryKind,
  Proposal,
  ProposalOp,
  ResumeDoc,
  ResumeItem,
  ResumeSection,
  ResumeBullet,
  SectionKey,
  Archetype,
} from "@offerben/core";

import type { Proposal as CoreProposal } from "@offerben/core";

// --- library store records (shared by server routes and client views) ---
export interface FileRecord {
  hash: string;
  name: string;
  mime: string;
  size: number;
  ext: string;
  addedAt: string;
  status: "processed" | "failed";
}

export interface DraftRecord {
  id: string;
  fileHash: string;
  fileName: string;
  fileMime: string;
  createdAt: string;
  proposal: CoreProposal;
}

export interface InboxFile {
  name: string;
  size: number;
  supported: boolean;
  reason?: string;
}

// Local copies of runtime constants (see APPLICATION_STATUSES for why).
export const SECTION_KEYS = [
  "education",
  "experience",
  "research",
  "projects",
  "publications",
  "demos",
  "talks",
  "awards",
  "skills",
] as const;

export const SECTION_LABELS: Record<(typeof SECTION_KEYS)[number], string> = {
  education: "Education",
  experience: "Experience",
  research: "Research",
  projects: "Projects",
  publications: "Publications",
  demos: "Public demos",
  talks: "Presentations",
  awards: "Awards",
  skills: "Skills",
};

export const ENTRY_KINDS = [
  "education",
  "position",
  "project",
  "publication",
  "demo",
  "talk",
  "award",
] as const;

// Local copy of the status list (a runtime value). Defined here rather than
// imported from core so the client bundle never pulls in core's server runtime.
export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "interviewing",
  "rejected",
  "offer",
] as const;

export type LetterOrQAKind = "coverLetter" | "recruiterEmail" | "referralNote" | "referralQA";
