import { z } from "zod";

/**
 * The library (资料库): everything resume-worthy the candidate has done, stored
 * as atomic entries. It is the source of truth; a resume is a per-job VIEW over
 * it (see resume/). It is meant to be much bigger than any one resume.
 *
 * Tolerant like ProfileSchema: every field defaults, so imperfect LLM output and
 * older library files parse instead of throwing.
 */

/** A string leaf that accepts null/undefined from the model and normalizes to "". */
const text = z
  .string()
  .nullish()
  .transform((v) => v ?? "");

export const ENTRY_KINDS = [
  "education",
  "position",
  "project",
  "publication",
  "demo",
  "talk",
  "award",
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** One atomic, verifiable statement. Resume bullets must cite these by id. */
export const FactSchema = z.object({
  id: z.string(),
  text,
  /** sha256 of the file this fact came from ("" = typed by the user). */
  source: text,
});
export type Fact = z.infer<typeof FactSchema>;

/** A photo / image attached to an entry (stored content-addressed by sha256). */
export const MediaSchema = z.object({
  file: z.string(),
  caption: text,
  mime: text,
});
export type Media = z.infer<typeof MediaSchema>;

export const EntrySchema = z.object({
  id: z.string(),
  kind: z.enum(ENTRY_KINDS).catch("project"),
  /** Positions only: which resume section they belong to by default. */
  section: z.enum(["experience", "research"]).catch("experience"),
  /**
   * Parent entry id ("" = top level). Projects done inside a lab or company point
   * at that position; publications / demos / talks point at their project.
   */
  parentId: text,
  /** Role ("Student Researcher"), project name, degree, paper title, award name. */
  title: text,
  /** Company / lab / institution / awarding body. */
  org: text,
  /** Second line: department, "PI: …", "Course Project, …". */
  subtitle: text,
  location: text,
  /** Dates as the candidate writes them, e.g. "Aug 2025", "Present". */
  start: text,
  end: text,
  /** Single-date items (publication, demo, talk, award). */
  date: text,
  /** Publication venue/status, or the event a demo/talk happened at. */
  venue: text,
  /** Author role on a publication, e.g. "Co-First Author". */
  role: text,
  gpa: text,
  url: text,
  urlLabel: text,
  facts: z.array(FactSchema).default([]),
  media: z.array(MediaSchema).default([]),
  tags: z.array(z.string()).default([]),
  /** sha256 hashes of the files this entry was built from (provenance). */
  sources: z.array(z.string()).default([]),
  /** Kept in the library but never put on a resume. */
  hidden: z.boolean().default(false),
  updatedAt: text,
});
export type LibraryEntry = z.infer<typeof EntrySchema>;

export const SkillGroupSchema = z.object({
  name: text,
  keywords: z.array(z.string()).default([]),
  /** Render on the same line as the previous group (saves a line). */
  sameLine: z.boolean().default(false),
});
export type SkillGroup = z.infer<typeof SkillGroupSchema>;

export const ContactSchema = z.object({ text, url: text });
export type Contact = z.infer<typeof ContactSchema>;

export const LibraryBasicsSchema = z.object({
  name: text,
  headline: text,
  /** Shown in this order on the header line ("Pittsburgh, PA", emails, site…). */
  contacts: z.array(ContactSchema).default([]),
});
export type LibraryBasics = z.infer<typeof LibraryBasicsSchema>;

export const LibrarySchema = z.object({
  version: z.literal(1).catch(1),
  basics: LibraryBasicsSchema.default({}),
  entries: z.array(EntrySchema).default([]),
  skills: z.array(SkillGroupSchema).default([]),
  updatedAt: text,
});
export type Library = z.infer<typeof LibrarySchema>;

export function emptyLibrary(): Library {
  return LibrarySchema.parse({});
}

// --- ingestion proposals ------------------------------------------------------

/** An entry as the model proposes it: no id yet, facts as plain strings. */
export const ProposedEntrySchema = EntrySchema.omit({
  id: true,
  facts: true,
  media: true,
  sources: true,
  updatedAt: true,
  hidden: true,
}).extend({
  /** Temporary id ("new-1") so later ops in the same proposal can point at it. */
  tempId: text,
  facts: z.array(z.string()).default([]),
});
export type ProposedEntry = z.infer<typeof ProposedEntrySchema>;

export const PROPOSAL_OPS = ["add", "addFacts", "attachMedia", "skills", "basics"] as const;

export const ProposalOpSchema = z.object({
  op: z.enum(PROPOSAL_OPS).catch("addFacts"),
  /** addFacts / attachMedia: an existing entry id or a tempId from this proposal. */
  entryId: text,
  entry: ProposedEntrySchema.nullish(),
  facts: z.array(z.string()).default([]),
  caption: text,
  /** Something only the candidate can answer (e.g. "What was your role here?"). */
  question: text,
  skills: z.array(SkillGroupSchema).default([]),
  basics: LibraryBasicsSchema.nullish(),
  reason: text,
});
export type ProposalOp = z.infer<typeof ProposalOpSchema>;

export const ProposalSchema = z.object({
  summary: text,
  ops: z.array(ProposalOpSchema).default([]),
});
export type Proposal = z.infer<typeof ProposalSchema>;
