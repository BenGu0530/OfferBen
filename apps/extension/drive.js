// Reads the user's profile from their own Google Drive — the same
// `offerben-data.json` the web app writes via "Drive ↑". Uses the
// least-privilege `drive.file` scope, so the extension only ever sees that one
// app-created file. Auth goes through chrome.identity.launchWebAuthFlow (works
// without bundling, reuses the web OAuth client id).

const CLIENT_ID =
  "972671167903-f9mjvi26sbq9eb6jenk4upokenhak2r9.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FILE_NAME = "offerben-data.json";
const FILES = "https://www.googleapis.com/drive/v3/files";

// The redirect URL chrome.identity hands back to. You must add this exact value
// to the OAuth client's "Authorized redirect URIs" in Google Cloud Console.
function redirectUri() {
  return chrome.identity.getRedirectURL();
}

async function getToken(interactive = true) {
  const url =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&response_type=token` +
    `&redirect_uri=${encodeURIComponent(redirectUri())}` +
    `&scope=${encodeURIComponent(SCOPE)}`;

  const redirect = await chrome.identity.launchWebAuthFlow({ url, interactive });
  // Token comes back in the URL fragment: ...#access_token=...&expires_in=...
  const frag = (redirect || "").split("#")[1] || "";
  const token = new URLSearchParams(frag).get("access_token");
  if (!token) throw new Error("Could not get a Google token.");
  return token;
}

async function findFileId(token) {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const res = await fetch(
    `${FILES}?q=${q}&spaces=drive&fields=files(id)&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive list failed (${res.status}).`);
  const body = await res.json();
  return (body.files && body.files[0] && body.files[0].id) || null;
}

// Pull the profile from Drive and cache it locally so future page loads can
// match instantly without re-prompting.
async function connectDrive() {
  const token = await getToken(true);
  const id = await findFileId(token);
  if (!id) throw new Error("No OfferBen data in Drive yet. In the web app, build your profile and click “Drive ↑”.");
  const res = await fetch(`${FILES}/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download failed (${res.status}).`);
  const data = await res.json();
  if (data.app !== "offerben" || !data.profile) throw new Error("Drive file has no profile.");
  await chrome.storage.local.set({ profile: data.profile, profileSyncedAt: Date.now() });
  return data.profile;
}

async function getCachedProfile() {
  const { profile } = await chrome.storage.local.get("profile");
  return profile || null;
}
