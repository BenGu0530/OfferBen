"use client";

import type { Job, Profile } from "./types";

/**
 * Local (browser) persistence for the MVP. When Supabase env vars are present,
 * this is where you'd swap in cloud sync (the @offerben/db client + RLS schema
 * are ready for that). For now everything lives in localStorage so the app runs
 * with zero backend setup.
 */

const KEYS = {
  profile: "offerben.profile.v1",
  job: "offerben.job.v1",
} as const;

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

export const storage = {
  loadProfile: () => read<Profile>(KEYS.profile),
  saveProfile: (p: Profile) => write(KEYS.profile, p),
  loadJob: () => read<Job>(KEYS.job),
  saveJob: (j: Job) => write(KEYS.job, j),
  clearProfile: () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(KEYS.profile);
  },
};
