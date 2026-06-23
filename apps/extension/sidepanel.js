const DEFAULT_APP_URL = "http://localhost:3000";

const els = {
  jobline: document.getElementById("jobline"),
  status: document.getElementById("status"),
  connect: document.getElementById("connect"),
  connectBtn: document.getElementById("connect-btn"),
  result: document.getElementById("result"),
  score: document.getElementById("score"),
  verdict: document.getElementById("verdict"),
  summary: document.getElementById("summary"),
  matched: document.getElementById("matched"),
  missing: document.getElementById("missing"),
  suggestions: document.getElementById("suggestions"),
  open: document.getElementById("open"),
  reread: document.getElementById("reread"),
  resync: document.getElementById("resync"),
  appUrl: document.getElementById("app-url"),
};

let appUrl = DEFAULT_APP_URL;
let currentJob = null; // last successfully read job
let lastUrl = null;
let matchCache = {}; // url -> { job, match } so revisits cost 0 API calls

const CACHE_KEY = "matchCache";
const CACHE_MAX = 40;

async function loadCache() {
  const s = await chrome.storage.local.get(CACHE_KEY);
  matchCache = s[CACHE_KEY] || {};
}

async function saveCache() {
  // keep the cache from growing unbounded
  const urls = Object.keys(matchCache);
  if (urls.length > CACHE_MAX) {
    for (const u of urls.slice(0, urls.length - CACHE_MAX)) delete matchCache[u];
  }
  await chrome.storage.local.set({ [CACHE_KEY]: matchCache });
}

// --- view helpers ----------------------------------------------------------

function show(view) {
  // view: "status" | "connect" | "result"
  els.status.classList.toggle("hidden", view !== "status");
  els.connect.classList.toggle("hidden", view !== "connect");
  els.result.classList.toggle("hidden", view !== "result");
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle("error", isError);
  show("status");
}

function setJobLine(job) {
  els.jobline.textContent = job
    ? [job.title, job.company].filter(Boolean).join(" · ").slice(0, 80) || "Job detected"
    : "Reads & scores the job you're viewing";
}

function chip(text) {
  const span = document.createElement("span");
  span.className = "chip";
  span.textContent = text;
  return span;
}

function renderMatch(match) {
  const score = Math.round(match.score ?? 0);
  els.score.textContent = String(score);
  els.score.className =
    "score " + (score >= 70 ? "good" : score >= 45 ? "ok" : "low");
  els.verdict.textContent = match.verdict || "";
  els.summary.textContent = match.summary || "";

  els.matched.replaceChildren(...(match.matchedKeywords || []).slice(0, 12).map(chip));
  els.missing.replaceChildren(...(match.missingKeywords || []).slice(0, 12).map(chip));
  els.suggestions.replaceChildren(
    ...(match.suggestions || []).slice(0, 4).map((s) => {
      const li = document.createElement("li");
      li.textContent = s;
      return li;
    }),
  );
  show("result");
}

// --- core flow -------------------------------------------------------------

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Read the JD off the current page (silent: no error flash while just browsing).
// allowVision: if DOM parsing fails, fall back to a screenshot + vision model.
// Gated to explicit actions (open / ⟳) so silent navigations don't burn quota.
async function readJob({ silent = false, allowVision = false } = {}) {
  const tab = await getActiveTab();
  if (!tab || !tab.id || /^(chrome|edge|about|chrome-extension):/.test(tab.url || "")) {
    if (!silent) setStatus("Open a job posting — I'll score it automatically.");
    return null;
  }
  lastUrl = tab.url;
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["extract.js"],
  });
  const job = injection && injection.result;
  if (job && job.description && job.description.length >= 80) return job;

  // DOM read failed — try the screenshot + vision fallback (e.g. LinkedIn).
  if (allowVision) {
    try {
      setStatus("Reading the page from a screenshot…");
      const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
      const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl.split(",")[1], mimeType: "image/png" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Vision capture failed (${res.status}).`);
      if (data.job && data.job.description && data.job.description.length >= 40) {
        return { ...data.job, url: tab.url, source: "vision" };
      }
    } catch (err) {
      if (!silent) setStatus(err && err.message ? err.message : "Vision read failed.", true);
      return null;
    }
  }

  if (!silent) setStatus("Couldn't find a job description on this page. Try ⟳.", true);
  return null;
}

// The whole pipeline: read JD -> (cached? have profile?) -> score -> render.
// `force` re-scores even if cached (the ⟳ button).
async function run({ silent = false, force = false } = {}) {
  try {
    const tab = await getActiveTab();
    const url = tab?.url || "";

    // Cache hit: render instantly, spend 0 API calls.
    if (!force && url && matchCache[url]) {
      lastUrl = url;
      currentJob = matchCache[url].job;
      setJobLine(currentJob);
      renderMatch(matchCache[url].match);
      return;
    }

    const profile = await getCachedProfile();
    const job = await readJob({ silent, allowVision: force || !silent });
    if (!job) return;

    currentJob = job;
    setJobLine(job);

    if (!profile) {
      show("connect");
      return;
    }

    setStatus(`Scoring against your profile…`);
    const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, job }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Match failed (${res.status}).`);
    renderMatch(data.match);

    if (lastUrl) {
      matchCache[lastUrl] = { job, match: data.match };
      void saveCache();
    }
  } catch (err) {
    setStatus(err && err.message ? err.message : "Something went wrong.", true);
  }
}

// --- autofill (skeleton) ---------------------------------------------------

// Build the value map the page filler matches against, from the profile.
function autofillValues(profile) {
  const b = (profile && profile.basics) || {};
  const full = (b.name || "").trim();
  const parts = full.split(/\s+/);
  const linkedin = (b.profiles || []).find((p) =>
    /linkedin/i.test(`${p.network || ""} ${p.url || ""}`),
  );
  return {
    fullName: full,
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
    email: b.email || "",
    phone: b.phone || "",
    linkedin: (linkedin && linkedin.url) || "",
    location: (b.location && (b.location.city || b.location.address)) || "",
  };
}

// Runs IN the page. Heuristically maps inputs to known fields and fills them.
// A skeleton: covers the common contact fields across most ATS forms; a full
// per-ATS registry comes later.
function fillFormInPage(values) {
  const RULES = [
    ["email", /e-?mail/i, (el) => el.type === "email"],
    ["phone", /phone|mobile|tel/i, (el) => el.type === "tel"],
    ["firstName", /first.?name|given.?name/i],
    ["lastName", /last.?name|surname|family.?name/i],
    ["fullName", /full.?name|your.?name|^name$|legal.?name/i],
    ["linkedin", /linked.?in/i],
    ["location", /city|location|address|town/i],
  ];

  function describe(el) {
    const bits = [el.name, el.id, el.placeholder, el.getAttribute("aria-label"), el.autocomplete];
    if (el.labels && el.labels[0]) bits.push(el.labels[0].textContent);
    return bits.filter(Boolean).join(" ").toLowerCase();
  }

  function setValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  let filled = 0;
  const fields = document.querySelectorAll("input, textarea");
  for (const el of fields) {
    if (el.type === "hidden" || el.type === "password" || el.disabled || el.value) continue;
    const desc = describe(el);
    if (!desc) continue;
    for (const [key, re, typeCheck] of RULES) {
      const value = values[key];
      if (!value) continue;
      if (re.test(desc) || (typeCheck && typeCheck(el))) {
        setValue(el, value);
        filled++;
        break;
      }
    }
  }
  return filled;
}

async function autofill() {
  try {
    const profile = await getCachedProfile();
    if (!profile) {
      show("connect");
      return;
    }
    const tab = await getActiveTab();
    if (!tab || !tab.id) return;
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillFormInPage,
      args: [autofillValues(profile)],
    });
    const n = (res && res.result) || 0;
    setStatus(n ? `Filled ${n} field${n > 1 ? "s" : ""}. Review before submitting.` : "No matching fields found on this page.", !n);
  } catch (err) {
    setStatus(err && err.message ? err.message : "Autofill failed.", true);
  }
}

async function tailorInOfferBen() {
  if (!currentJob) return;
  const job = { ...currentJob, url: lastUrl || "", source: currentJob.source || "extension" };
  const base = appUrl.replace(/\/+$/, "");
  const utf8 = encodeURIComponent(JSON.stringify(job)).replace(/%([0-9A-F]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
  const payload = btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await chrome.tabs.create({ url: `${base}/?job=${payload}` });
}

async function doConnect() {
  setStatus("Opening Google sign-in…");
  try {
    await connectDrive();
    setStatus("Profile connected. Scoring…");
    await run();
  } catch (err) {
    setStatus(err && err.message ? err.message : "Connect failed.", true);
  }
}

// --- auto re-run as the user moves between pages ---------------------------

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab?.url && tab.url !== lastUrl) run({ silent: true });
});
chrome.tabs.onUpdated.addListener((_id, info, tab) => {
  if (info.status === "complete" && tab.active && tab.url !== lastUrl) run({ silent: true });
});

async function init() {
  const stored = await chrome.storage.local.get("appUrl");
  appUrl = stored.appUrl || DEFAULT_APP_URL;
  els.appUrl.value = appUrl;
  await loadCache();

  els.reread.addEventListener("click", () => run({ force: true }));
  els.open.addEventListener("click", tailorInOfferBen);
  document.getElementById("autofill").addEventListener("click", autofill);
  els.connectBtn.addEventListener("click", doConnect);
  els.resync.addEventListener("click", doConnect);
  els.appUrl.addEventListener("change", () => {
    appUrl = els.appUrl.value.trim() || DEFAULT_APP_URL;
    chrome.storage.local.set({ appUrl });
  });

  await run();
}

document.addEventListener("DOMContentLoaded", init);
