"use client";

import type { Job } from "./types";

/**
 * The browser extension (Phase 2) captures a job from a career page and hands it
 * off to this web app by opening:
 *
 *   http://localhost:3000/?job=<base64url-encoded JSON>
 *
 * Keeping the handoff in the URL means the extension never needs the Gemini key
 * (which stays server-side here). This helper decodes that payload.
 */
export function readJobFromUrl(): Job | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("job");
  if (!raw) return null;

  try {
    const json = decodeBase64Url(raw);
    const obj = JSON.parse(json) as Partial<Job>;
    const job: Job = {
      title: String(obj.title ?? ""),
      company: String(obj.company ?? ""),
      url: obj.url ? String(obj.url) : undefined,
      source: obj.source ? String(obj.source) : undefined,
      description: String(obj.description ?? ""),
    };
    if (!job.description.trim()) return null;

    // Clean the URL so a refresh doesn't re-import.
    params.delete("job");
    const clean =
      window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState({}, "", clean);

    return job;
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
