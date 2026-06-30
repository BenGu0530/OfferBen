"use client";

import type { AppData } from "./types";

/**
 * Optional Google Drive sync for the web app. Uses Google Identity Services
 * (GIS) to obtain a short-lived OAuth token in the browser with the
 * least-privilege `drive.file` scope — the app can only ever touch the single
 * `offerben-data.json` file it creates, never the rest of the user's Drive.
 *
 * This is a self-contained client copy of the Drive REST logic (the canonical,
 * reusable version lives in `@offerben/core`'s GoogleDriveStore for the
 * extension + server). Duplicated here on purpose so the client bundle never
 * pulls in core's server-only Gemini runtime — same boundary lib/types.ts keeps.
 *
 * Disabled (driveEnabled() === false) until NEXT_PUBLIC_GOOGLE_CLIENT_ID is set.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FILE_NAME = "offerben-data.json";
const MIME = "application/json";
const FILES = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

export function driveEnabled(): boolean {
  return CLIENT_ID.length > 0;
}

// --- GIS token client ------------------------------------------------------

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window."));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google sign-in."));
    document.head.appendChild(s);
  });
  return gisPromise;
}

let cachedToken: string | null = null;

/** Acquire a `drive.file` access token, prompting the user to sign in once. */
async function getToken(): Promise<string> {
  if (!driveEnabled()) throw new Error("Google Drive sync is not configured.");
  if (cachedToken) return cachedToken;
  await loadGis();

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (settled) return;
        settled = true;
        if (resp.error || !resp.access_token) {
          reject(new Error("Google sign-in failed. Add your email as a Test user on the OAuth consent screen."));
          return;
        }
        cachedToken = resp.access_token;
        resolve(resp.access_token);
      },
      // Fires when the popup is closed/blocked or access is denied. Without this
      // the promise would hang forever and the button would stay disabled.
      error_callback: (err) => {
        if (settled) return;
        settled = true;
        reject(
          new Error(
            err?.type === "popup_closed"
              ? "Sign-in window was closed."
              : "Sign-in blocked — add your email as a Test user (see notes).",
          ),
        );
      },
    });
    client.requestAccessToken();
  });
}

// --- Drive REST ------------------------------------------------------------

async function findFileId(auth: { Authorization: string }): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const url = `${FILES}?q=${q}&spaces=drive&fields=files(id)&orderBy=modifiedTime desc`;
  const res = await fetch(url, { headers: auth });
  if (!res.ok) throw new Error(`Drive list failed (${res.status}).`);
  const body = (await res.json()) as { files?: Array<{ id: string }> };
  return body.files?.[0]?.id ?? null;
}

/** Progress callback so the UI can show what step is running. */
export type OnStatus = (msg: string) => void;

/** Pull the stored AppData from the user's Drive, or null if none exists yet. */
export async function loadFromDrive(onStatus?: OnStatus): Promise<AppData | null> {
  onStatus?.("Signing in to Google…");
  const token = await getToken();
  const auth = { Authorization: `Bearer ${token}` };
  onStatus?.("Looking for your data…");
  const id = await findFileId(auth);
  if (!id) return null;
  onStatus?.("Downloading…");
  const res = await fetch(`${FILES}/${id}?alt=media`, { headers: auth });
  if (!res.ok) throw new Error(`Drive download failed (${res.status}).`);
  const text = await res.text();
  if (!text.trim()) return null;
  const parsed = JSON.parse(text) as Partial<AppData>;
  if (parsed.app !== "offerben") throw new Error("The Drive file is not an OfferBen backup.");
  return parsed as AppData;
}

/** Push AppData to the user's Drive (create or overwrite the app's file). */
export async function saveToDrive(data: AppData, onStatus?: OnStatus): Promise<void> {
  onStatus?.("Signing in to Google…");
  const token = await getToken();
  const auth = { Authorization: `Bearer ${token}` };
  onStatus?.("Uploading to Drive…");
  const id = await findFileId(auth);
  const content = JSON.stringify(data, null, 2);

  if (id) {
    const res = await fetch(`${UPLOAD}/${id}?uploadType=media`, {
      method: "PATCH",
      headers: { ...auth, "Content-Type": MIME },
      body: content,
    });
    if (!res.ok) throw new Error(`Drive update failed (${res.status}).`);
    return;
  }

  const boundary = "offerben-boundary-7e3b";
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify({ name: FILE_NAME, mimeType: MIME })}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${MIME}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;
  const res = await fetch(`${UPLOAD}?uploadType=multipart`, {
    method: "POST",
    headers: { ...auth, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Drive create failed (${res.status}).`);
}

// --- Per-application document files (My Drive/OfferBen/applications/*.md) -----
// Each saved application is one app-created Markdown file the user can browse,
// open, and share in their own Drive — and that the app can re-read (drive.file
// can see files it created). Folders/files here are all app-created.

const FOLDER_MIME = "application/vnd.google-apps.folder";
const MD_MIME = "text/markdown";
let cachedFolderId: string | null = null;

async function findOrCreateFolder(
  auth: { Authorization: string },
  name: string,
  parentId?: string,
): Promise<string> {
  const parent = parentId ? ` and '${parentId}' in parents` : "";
  const q = encodeURIComponent(
    `name='${name}' and mimeType='${FOLDER_MIME}' and trashed=false${parent}`,
  );
  const found = await fetch(`${FILES}?q=${q}&spaces=drive&fields=files(id)`, { headers: auth });
  if (found.ok) {
    const body = (await found.json()) as { files?: Array<{ id: string }> };
    if (body.files?.[0]?.id) return body.files[0].id;
  }
  const meta = { name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) };
  const made = await fetch(`${FILES}?fields=id`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(meta),
  });
  if (!made.ok) throw new Error(`Drive folder create failed (${made.status}).`);
  return ((await made.json()) as { id: string }).id;
}

async function appFolderId(auth: { Authorization: string }): Promise<string> {
  if (cachedFolderId) return cachedFolderId;
  const root = await findOrCreateFolder(auth, "OfferBen");
  cachedFolderId = await findOrCreateFolder(auth, "applications", root);
  return cachedFolderId;
}

function safeName(s: string): string {
  return (s || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export interface SavedDoc {
  fileId: string;
  url?: string;
}

/**
 * Write an application's generated docs as a Markdown file in the user's
 * OfferBen/applications folder. Updates `fileId` in place if given, else creates
 * a new file. Returns the file id + a link to open it in Drive.
 */
export async function saveApplicationToDrive(
  opts: { title: string; company: string; fileId?: string; markdown: string },
  onStatus?: OnStatus,
): Promise<SavedDoc> {
  onStatus?.("Signing in to Google…");
  const token = await getToken();
  const auth = { Authorization: `Bearer ${token}` };

  if (opts.fileId) {
    onStatus?.("Saving to Drive…");
    const res = await fetch(`${UPLOAD}/${opts.fileId}?uploadType=media&fields=id,webViewLink`, {
      method: "PATCH",
      headers: { ...auth, "Content-Type": MD_MIME },
      body: opts.markdown,
    });
    if (!res.ok) throw new Error(`Drive update failed (${res.status}).`);
    const b = (await res.json()) as { id: string; webViewLink?: string };
    return { fileId: b.id, url: b.webViewLink };
  }

  onStatus?.("Creating the file in your Drive…");
  const folderId = await appFolderId(auth);
  const name = `${safeName(opts.company) || "Company"} — ${safeName(opts.title) || "Role"}.md`;
  const boundary = "offerben-doc-7e3b";
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify({ name, mimeType: MD_MIME, parents: [folderId] })}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${MD_MIME}\r\n\r\n` +
    `${opts.markdown}\r\n` +
    `--${boundary}--`;
  const res = await fetch(`${UPLOAD}?uploadType=multipart&fields=id,webViewLink`, {
    method: "POST",
    headers: { ...auth, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Drive create failed (${res.status}).`);
  const b = (await res.json()) as { id: string; webViewLink?: string };
  return { fileId: b.id, url: b.webViewLink };
}
