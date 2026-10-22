"use client";

import type { Job, MatchResult } from "./types";

export interface Handoff {
  job: Job;
  /** The match score the extension already computed, if any — reused so the
   *  web app shows the same number instead of re-scoring (saves an AI call). */
  match: MatchResult | null;
}

/**
 * The browser extension (Phase 2) captures a job from a career page and hands it
 * off to this web app by opening:
 *
 *   http://localhost:3000/?job=<base64url-encoded JSON>
 *
 * Keeping the handoff in the URL means the extension never needs the Gemini key
 * (which stays server-side here). This helper decodes that payload.
 */
/**
 * The extension hands a captured job to the web app. Preferred path: `?h=<id>`,
 * a short token resolved via /api/handoff (keeps the long JD out of the URL —
 * the old base64-in-URL approach overflowed header limits → HTTP 431). Legacy
 * `?job=<base64>` is still decoded as a fallback.
 */
export async function readJobFromUrl(): Promise<Handoff | null> {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);

  const token = params.get("h");
  if (token) {
    try {
      const res = await fetch(`/api/handoff?id=${encodeURIComponent(token)}`);
      cleanUrl(params, "h");
      if (!res.ok) return null;
      const { job, match } = (await res.json()) as {
        job?: Partial<Job>;
        match?: MatchResult | null;
      };
      if (!job || !String(job.description ?? "").trim()) return null;
      return { job: normalizeJob(job), match: sanitizeMatch(match) };
    } catch {
      cleanUrl(params, "h");
      return null;
    }
  }

  return readLegacyJob(params);
}

/** Keep only http/https URLs; anything else (javascript:, data:, …) is dropped. */
function safeUrl(u?: string): string | undefined {
  if (!u) return undefined;
  try {
    const p = new URL(String(u), "http://x");
    return p.protocol === "http:" || p.protocol === "https:" ? String(u) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A handoff/legacy payload is untrusted input. Drop a broken `match` rather than
 * pass a malformed shape (e.g. non-numeric score) downstream to the UI/scorer.
 */
function sanitizeMatch(match: MatchResult | null | undefined): MatchResult | null {
  if (!match) return null;
  if (typeof match.score !== "number" || Number.isNaN(match.score)) return null;
  return match;
}

function normalizeJob(obj: Partial<Job>): Job {
  return {
    title: String(obj.title ?? ""),
    company: String(obj.company ?? ""),
    url: safeUrl(obj.url ? String(obj.url) : undefined),
    source: obj.source ? String(obj.source) : undefined,
    description: String(obj.description ?? ""),
  };
}

function cleanUrl(params: URLSearchParams, key: string) {
  params.delete(key);
  const clean = window.location.pathname + (params.toString() ? `?${params}` : "");
  window.history.replaceState({}, "", clean);
}

function readLegacyJob(params: URLSearchParams): Handoff | null {
  const raw = params.get("job");
  if (!raw) return null;

  try {
    const json = decodeBase64Url(raw);
    const obj = JSON.parse(json) as Partial<Job>;
    const job: Job = normalizeJob(obj);
    if (!job.description.trim()) return null;

    // Clean the URL so a refresh doesn't re-import.
    params.delete("job");
    const clean = window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState({}, "", clean);

    return { job, match: null };
  } catch {
    return null;
  }
}

function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  if (typeof atob === "function") {
    const bytes = atob(padded);
    try {
      // handle UTF-8
      return decodeURIComponent(
        Array.from(bytes)
          .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join(""),
      );
    } catch {
      return bytes;
    }
  }
  return Buffer.from(padded, "base64").toString("utf-8");
}
