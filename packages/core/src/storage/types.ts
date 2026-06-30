import type { Job } from "../schema/job";
import type { Profile } from "../schema/profile";

/** Lifecycle status of a tracked application. */
export type ApplicationStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "rejected"
  | "offer";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "saved",
  "applied",
  "interviewing",
  "rejected",
  "offer",
];

/** One tracked job application in the history/tracker. */
export interface ApplicationRecord {
  id: string;
  title: string;
  company: string;
  url?: string;
  score?: number;
  verdict?: string;
  status: ApplicationStatus;
  notes?: string;
  /** Drive file holding the generated docs for this application (app-created). */
  driveFileId?: string;
  driveUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * The full, portable "everything about me" container that a storage backend
 * persists. Mirrors the web app's local backup shape so local <-> cloud round
 * trips are lossless.
 */
export interface AppData {
  app: "offerben";
  version: 1;
  /** ISO timestamp of the last write; used for last-write-wins conflict notes. */
  updatedAt: string;
  profile: Profile | null;
  job: Job | null;
  /** Tracked application history. Optional for backward-compatible Drive files. */
  applications?: ApplicationRecord[];
}

/**
 * Backend-agnostic persistence. The web app, the extension, and any future
 * surface depend only on this interface, so local storage, Google Drive, or a
 * server DB are interchangeable. Keeping it tiny (load/save of one blob) is
 * deliberate: it works for a hidden JSON file in the user's own Drive just as
 * well as for localStorage.
 */
export interface ProfileStore {
  /** Returns the stored data, or null if the backend has nothing yet. */
  load(): Promise<AppData | null>;
  /** Overwrites the stored data. */
  save(data: AppData): Promise<void>;
}

export function emptyAppData(now: string): AppData {
  return { app: "offerben", version: 1, updatedAt: now, profile: null, job: null };
}
