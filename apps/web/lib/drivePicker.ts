"use client";

import { getDriveToken } from "./drive";

/**
 * Google Picker: let the user choose a resume PDF from their own Drive. The
 * Picker grants the app per-file access to just the chosen file (still the
 * least-privilege `drive.file` scope — we never see the rest of their Drive).
 *
 * Needs a public API key (NEXT_PUBLIC_GOOGLE_API_KEY) in addition to the OAuth
 * client id used for Drive sync. Disabled until both are set.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";

export function pickerEnabled(): boolean {
  return CLIENT_ID.length > 0 && API_KEY.length > 0;
}

function w(): any {
  return window as any;
}

let gapiPromise: Promise<void> | null = null;
function loadPicker(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window."));
  if (w().google?.picker) return Promise.resolve();
  if (gapiPromise) return gapiPromise;
  gapiPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.onload = () => w().gapi.load("picker", { callback: () => resolve(), onerror: reject });
    s.onerror = () => reject(new Error("Failed to load Google Picker."));
    document.head.appendChild(s);
  });
  return gapiPromise;
}

/** Open the Picker; resolve with the chosen file's id, or null if cancelled. */
async function pickFileId(token: string): Promise<string | null> {
  await loadPicker();
  const g = w().google;
  return new Promise<string | null>((resolve) => {
    const view = new g.picker.DocsView(g.picker.ViewId.DOCS)
      .setMimeTypes("application/pdf,text/plain")
      .setMode(g.picker.DocsViewMode.LIST);
    const picker = new g.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setCallback((data: { action: string; docs?: Array<{ id: string }> }) => {
        if (data.action === g.picker.Action.PICKED) resolve(data.docs?.[0]?.id ?? null);
        else if (data.action === g.picker.Action.CANCEL) resolve(null);
      })
      .build();
    picker.setVisible(true);
  });
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export interface PickedFile {
  base64: string;
  mimeType: string;
}

/** Sign in, let the user pick a file, download it, return base64 + mime. */
export async function pickResumeFromDrive(): Promise<PickedFile | null> {
  const token = await getDriveToken();
  const id = await pickFileId(token);
  if (!id) return null;

  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?fields=mimeType,name`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!metaRes.ok) throw new Error(`Drive read failed (${metaRes.status}).`);
  const meta = (await metaRes.json()) as { mimeType: string };

  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!fileRes.ok) throw new Error(`Drive download failed (${fileRes.status}).`);
  return { base64: toBase64(await fileRes.arrayBuffer()), mimeType: meta.mimeType || "application/pdf" };
}
