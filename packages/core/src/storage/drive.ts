import type { AppData, ProfileStore } from "./types";

/**
 * Google Drive storage backend using the least-privilege `drive.file` OAuth
 * scope: the app can only ever see files it created itself, never the rest of
 * the user's Drive. This keeps the published extension out of Google's costly
 * "restricted scope" (CASA) security review while still giving every user free,
 * cross-device, user-owned sync.
 *
 * Framework-agnostic: it only does `fetch` against the Drive REST API and takes
 * an injected `getToken()`, so the same class works in the Next.js web app
 * (Google Identity Services), a bundled browser extension (chrome.identity), or
 * Node. The OAuth client setup is the caller's job.
 */

/** Returns a valid OAuth2 access token with the `drive.file` scope. */
export type TokenGetter = () => Promise<string>;

const FILE_NAME = "offerben-data.json";
const MIME = "application/json";
const FILES = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

export class GoogleDriveStore implements ProfileStore {
  constructor(private readonly getToken: TokenGetter) {}

  private async auth(): Promise<{ Authorization: string }> {
    const token = await this.getToken();
    if (!token) throw new Error("Google sign-in was cancelled.");
    return { Authorization: `Bearer ${token}` };
  }

  /** Find the app's data file (only files this app created are visible). */
  private async findFileId(headers: { Authorization: string }): Promise<string | null> {
    const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const url = `${FILES}?q=${q}&spaces=drive&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Drive list failed (${res.status}).`);
    const body = (await res.json()) as { files?: Array<{ id: string }> };
    return body.files?.[0]?.id ?? null;
  }

  async load(): Promise<AppData | null> {
    const headers = await this.auth();
    const id = await this.findFileId(headers);
    if (!id) return null;

    const res = await fetch(`${FILES}/${id}?alt=media`, { headers });
    if (!res.ok) throw new Error(`Drive download failed (${res.status}).`);
    const text = await res.text();
    if (!text.trim()) return null;

    const parsed = JSON.parse(text) as Partial<AppData>;
    if (parsed.app !== "offerben") {
      throw new Error("The Drive file is not an OfferBen backup.");
    }
    return parsed as AppData;
  }

  async save(data: AppData): Promise<void> {
    const headers = await this.auth();
    const id = await this.findFileId(headers);
    const content = JSON.stringify(data, null, 2);

    if (id) {
      // Update the existing file's contents in place.
      const res = await fetch(`${UPLOAD}/${id}?uploadType=media`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": MIME },
        body: content,
      });
      if (!res.ok) throw new Error(`Drive update failed (${res.status}).`);
      return;
    }

    // Create a new file (metadata + content) via a multipart upload.
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
      headers: { ...headers, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!res.ok) throw new Error(`Drive create failed (${res.status}).`);
  }
}
