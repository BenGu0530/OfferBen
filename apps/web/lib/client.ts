"use client";

import { aiHeaders } from "./aiSettings";
import type {
  AuthorCandidate,
  AuthorDossier,
  InterviewPrep,
  Job,
  MatchResult,
  OutreachKind,
  ParsedJob,
  Profile,
  ReferralQA,
  ResearchTaste,
  TailoredResume,
  Library,
  DraftRecord,
  InboxFile,
  ResumeDoc,
  SectionKey,
} from "./types";

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...aiHeaders() },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((data?.error as string) || `Request failed (${res.status}).`);
  }
  return data as T;
}

export const api = {
  extractProfile: (input: { text?: string; fileBase64?: string; mimeType?: string }) =>
    postJSON<{ profile: Profile }>("/api/profile/extract", input),

  match: (input: { profile: Profile; job: Job }) =>
    postJSON<{ parsed: ParsedJob; match: MatchResult }>("/api/match", input),

  tailor: (input: {
    profile: Profile;
    job: Job;
    parsed?: ParsedJob;
    match?: MatchResult;
    pageTarget?: 1 | 2;
  }) => postJSON<{ resume: TailoredResume }>("/api/tailor", input),

  letter: (input: {
    profile: Profile;
    job: Job;
    kind: "coverLetter" | "recruiterEmail" | "referralNote";
  }) => postJSON<{ text: string }>("/api/letters", input),

  referralQA: (input: { profile: Profile; job: Job }) =>
    postJSON<{ qa: ReferralQA }>("/api/letters", { ...input, kind: "referralQA" }),

  interview: (input: { profile: Profile; job: Job }) =>
    postJSON<{ prep: InterviewPrep }>("/api/interview", input),

  searchPeople: (input: { name: string; institution?: string }) =>
    postJSON<{ candidates: AuthorCandidate[] }>("/api/people/search", input),

  dossier: (input: { authorId: string; skipTaste?: boolean }) =>
    postJSON<{ dossier: AuthorDossier; taste: ResearchTaste | null; tasteError?: string }>(
      "/api/people/dossier",
      input,
    ),

  outreach: (input: {
    profile: Profile;
    person: AuthorDossier;
    taste?: ResearchTaste | null;
    kind: OutreachKind;
  }) => postJSON<{ text: string }>("/api/people/outreach", input),
};

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((data?.error as string) || `Request failed (${res.status}).`);
  return data as T;
}

export interface LibraryPayload {
  home: string;
  library: Library;
  profile: Profile;
  inbox: InboxFile[];
  drafts: DraftRecord[];
  fileCount: number;
}

export interface BuiltResumePayload {
  doc: ResumeDoc;
  tex: string;
  pdfBase64: string | null;
  pages: number | null;
  density: number;
  notes: string[];
  warnings: string[];
}

/** Library (资料库) + LaTeX resume endpoints. Only `process` and `resume(plan)` spend AI calls. */
export const libraryApi = {
  get: () => getJSON<LibraryPayload>("/api/library"),

  save: (library: Library) =>
    postJSON<{ library: Library; profile: Profile }>("/api/library", { library }),

  upload: (files: { name: string; base64: string }[]) =>
    postJSON<{ saved: string[]; inbox: InboxFile[] }>("/api/library/upload", { files }),

  process: (max: number) =>
    postJSON<{
      processed: { name: string; status: string; error?: string }[];
      stoppedReason?: string;
      inbox: InboxFile[];
      drafts: DraftRecord[];
    }>("/api/library/process", { max }),

  draft: (input: {
    draftId: string;
    action: "apply" | "discard";
    accept?: number[];
    notes?: Record<number, string>;
  }) =>
    postJSON<{ library: Library; profile: Profile; log: string[]; drafts: DraftRecord[] }>(
      "/api/library/draft",
      input,
    ),

  resume: (input: {
    mode: "plan" | "default" | "render";
    job?: Job;
    doc?: ResumeDoc;
    sections?: SectionKey[];
    pageTarget?: 1 | 2;
  }) => postJSON<BuiltResumePayload>("/api/resume", input),
};

/** Read a File as base64 (without the data: prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
