"use client";

import type { AppData, ApplicationRecord, Job, Profile } from "./types";

/**
 * Local (browser) persistence for the MVP. When Supabase env vars are present,
 * this is where you'd swap in cloud sync (the @offerben/db client + RLS schema
 * are ready for that). For now everything lives in localStorage so the app runs
 * with zero backend setup.
 */

const KEYS = {
  profile: "offerben.profile.v1",
  job: "offerben.job.v1",
  applications: "offerben.applications.v1",
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

export interface BackupFile {
  app: "offerben";
  version: 1;
  exportedAt: string;
  profile: Profile | null;
  job: Job | null;
  applications?: ApplicationRecord[];
}

export const storage = {
  loadProfile: () => read<Profile>(KEYS.profile),
  saveProfile: (p: Profile) => write(KEYS.profile, p),
  loadJob: () => read<Job>(KEYS.job),
  saveJob: (j: Job) => write(KEYS.job, j),
  clearProfile: () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(KEYS.profile);
  },

  // --- application tracker ---
  loadApplications: (): ApplicationRecord[] => read<ApplicationRecord[]>(KEYS.applications) ?? [],
  /** Insert or update by id; newest first. Returns the updated list. */
  saveApplication(app: ApplicationRecord): ApplicationRecord[] {
    const list = (read<ApplicationRecord[]>(KEYS.applications) ?? []).filter((a) => a.id !== app.id);
    const next = [app, ...list];
    write(KEYS.applications, next);
    return next;
  },
  removeApplication(id: string): ApplicationRecord[] {
    const next = (read<ApplicationRecord[]>(KEYS.applications) ?? []).filter((a) => a.id !== id);
    write(KEYS.applications, next);
    return next;
  },

  /** Serialize everything to a portable JSON string (for cross-machine backup). */
  exportAll(): string {
    const data: BackupFile = {
      app: "offerben",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: read<Profile>(KEYS.profile),
      job: read<Job>(KEYS.job),
      applications: read<ApplicationRecord[]>(KEYS.applications) ?? [],
    };
    return JSON.stringify(data, null, 2);
  },

  /** Load a previously exported backup. Returns the parsed payload. */
  importAll(json: string): BackupFile {
    const parsed = JSON.parse(json) as Partial<BackupFile>;
    if (parsed.app !== "offerben") {
      throw new Error("This file is not an OfferBen backup.");
    }
    if (parsed.profile) write(KEYS.profile, parsed.profile);
    if (parsed.job) write(KEYS.job, parsed.job);
    if (parsed.applications) write(KEYS.applications, parsed.applications);
    return parsed as BackupFile;
  },

  /** Current local state as the portable AppData blob (for cloud sync). */
  snapshot(): AppData {
    return {
      app: "offerben",
      version: 1,
      updatedAt: new Date().toISOString(),
      profile: read<Profile>(KEYS.profile),
      job: read<Job>(KEYS.job),
      applications: read<ApplicationRecord[]>(KEYS.applications) ?? [],
    };
  },

  /** Write an AppData blob (e.g. pulled from Drive) into local storage. */
  restore(data: AppData): void {
    if (data.profile) write(KEYS.profile, data.profile);
    if (data.job) write(KEYS.job, data.job);
    if (data.applications) write(KEYS.applications, data.applications);
  },
};
