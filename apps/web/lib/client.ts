"use client";

import type {
  Job,
  MatchResult,
  ParsedJob,
  Profile,
  ReferralQA,
  TailoredResume,
} from "./types";

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      (data?.error as string) || `Request failed (${res.status}).`,
    );
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
  }) => postJSON<{ resume: TailoredResume }>("/api/tailor", input),

  letter: (input: {
    profile: Profile;
    job: Job;
    kind: "coverLetter" | "recruiterEmail" | "referralNote";
  }) => postJSON<{ text: string }>("/api/letters", input),

  referralQA: (input: { profile: Profile; job: Job }) =>
    postJSON<{ qa: ReferralQA }>("/api/letters", { ...input, kind: "referralQA" }),
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
