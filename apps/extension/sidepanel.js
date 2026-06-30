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
  scoreBtn: document.getElementById("score-btn"),
  importLi: document.getElementById("import-li"),
  autoScore: document.getElementById("autoscore"),
  genStatus: document.getElementById("gen-status"),
  genOut: document.getElementById("gen-out"),
  genCopy: document.getElementById("gen-copy"),
  ansWorkauth: document.getElementById("ans-workauth"),
  ansSponsor: document.getElementById("ans-sponsor"),
  ansEeo: document.getElementById("ans-eeo"),
};

let appUrl = DEFAULT_APP_URL;
let currentJob = null; // last successfully read job
let lastUrl = null;
let autoScore = false; // off by default: don't spend AI on every page you open
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
  toggleScoreBtn(false);
  toggleImportBtn(false);
  resetGen();
  show("result");
}

// --- core flow -------------------------------------------------------------

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// The OfferBen web app is not a job posting — never score our own pages.
function isOwnApp(url) {
  return Boolean(url) && url.startsWith(appUrl.replace(/\/+$/, ""));
}

function isLinkedInProfile(url) {
  return /:\/\/(www\.)?linkedin\.com\/in\//.test(url || "");
}

function toggleImportBtn(showIt) {
  if (els.importLi) els.importLi.classList.toggle("hidden", !showIt);
}

// Injected into the page: read the visible profile text. Compliant — it reads
// the page the user opened and is viewing (their own profile), nothing more.
function readProfileTextInPage() {
  const main = document.querySelector("main");
  const text = (main || document.body).innerText || "";
  return text.replace(/\n{3,}/g, "\n\n").trim().slice(0, 24000);
}

// Import the LinkedIn profile the user is viewing -> structured profile, via the
// existing /api/profile/extract. Saves it as the extension's active profile
// (used by scoring + autofill).
async function importLinkedIn() {
  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id || !isLinkedInProfile(tab.url)) return;
    setStatus("Reading your LinkedIn profile…");
    toggleImportBtn(false);
    const [inj] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readProfileTextInPage,
    });
    const text = (inj && inj.result) || "";
    if (text.length < 200) throw new Error("Couldn't read the profile. Scroll to load it, then retry.");

    setStatus("Extracting your profile…");
    const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/profile/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.profile) throw new Error(data.error || `Extract failed (${res.status}).`);

    await chrome.storage.local.set({ profile: data.profile, profileSyncedAt: Date.now() });
    const b = data.profile.basics || {};
    const n = (data.profile.work || []).length;
    setStatus(`✓ Imported ${b.name || "your profile"} (${n} role${n === 1 ? "" : "s"}). It's now your scoring profile.`);
  } catch (err) {
    setStatus(err && err.message ? err.message : "Import failed.", true);
    toggleImportBtn(true);
  }
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
    toggleScoreBtn(false);
    toggleImportBtn(false);
    const tab = await getActiveTab();
    const url = tab?.url || "";

    if (isOwnApp(url)) {
      setJobLine(null);
      setStatus("You're in the OfferBen app. Open a job posting in another tab to score it.");
      return;
    }
    if (isLinkedInProfile(url)) {
      setJobLine(null);
      setStatus("On a LinkedIn profile. Import it to build your OfferBen profile.");
      toggleImportBtn(true);
      return;
    }

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
    toggleScoreBtn(true); // let the user retry
  }
}

// --- autofill (v2) ---------------------------------------------------------

// Build the value map the page filler matches against, from the profile.
function autofillValues(profile) {
  const b = (profile && profile.basics) || {};
  const loc = b.location || {};
  const work0 = (profile && profile.work && profile.work[0]) || {};
  const edu0 = (profile && profile.education && profile.education[0]) || {};
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
    website: b.url || "",
    city: loc.city || "",
    state: loc.region || "",
    country: loc.countryCode || "",
    address: loc.address || "",
    currentCompany: work0.name || "",
    currentTitle: work0.position || "",
    school: edu0.institution || "",
    degree: edu0.studyType || "",
    fieldOfStudy: edu0.area || "",
  };
}

// Runs IN the page. Maps inputs/textareas/selects/radios to known fields.
// Sensitive fields (work auth / sponsorship / EEO) are only answered from the
// user's PRE-STORED answers (opt-in) — we never guess demographics. Salary / DOB
// / SSN are always skipped. This keeps the review-gate principle intact.
function fillFormInPage(values, answers) {
  answers = answers || {};
  const RULES = [
    ["email", /e-?mail/i, (el) => el.type === "email"],
    ["phone", /phone|mobile|tel/i, (el) => el.type === "tel"],
    ["firstName", /first.?name|given.?name|fname/i],
    ["lastName", /last.?name|surname|family.?name|lname/i],
    ["fullName", /full.?name|your.?name|^name$|legal.?name|preferred.?name/i],
    ["linkedin", /linked.?in/i],
    ["website", /website|portfolio|personal.?site|github|url/i],
    ["currentTitle", /current.?title|job.?title|current.?role|present.?title/i],
    ["currentCompany", /current.?company|current.?employer|present.?company/i],
    ["school", /school|university|college|institution/i],
    ["degree", /degree|qualification/i],
    ["fieldOfStudy", /field.?of.?study|major|discipline/i],
    ["city", /(^|[^a-z])city|town/i],
    ["state", /state|province|region/i],
    ["country", /country/i],
    ["address", /street|address.?line|^address$/i],
  ];

  const WORK_AUTH = /authoriz|work.?permit|eligible to work|right to work|legally.*work/i;
  const SPONSOR = /sponsor|visa|require.?spons/i;
  const DEMO = /gender|(^|[^a-z])sex\b|race|ethnic|hispanic|latino|veteran|disab/i;
  const HARD_SKIP = /salary|compensation|expected.?pay|desired.?pay|date.?of.?birth|\bdob\b|ssn|social.?security/i;
  const DECLINE = /decline|prefer not|don'?t wish|do not wish|not to (answer|disclose|identify)/i;

  function describe(el) {
    const bits = [
      el.name,
      el.id,
      el.placeholder,
      el.getAttribute("aria-label"),
      el.autocomplete,
      el.getAttribute("data-automation-id"), // Workday
    ];
    if (el.labels && el.labels[0]) bits.push(el.labels[0].textContent);
    const wrap = el.closest("label, .field, fieldset, [class*='field'], [role='group']");
    if (wrap) bits.push((wrap.textContent || "").slice(0, 160));
    return bits.filter(Boolean).join(" ").toLowerCase();
  }

  function setInput(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function setSelect(el, value) {
    const want = value.toLowerCase();
    const opt = Array.from(el.options).find(
      (o) => o.text.toLowerCase().includes(want) || o.value.toLowerCase() === want,
    );
    if (!opt) return false;
    el.value = opt.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function selectByRegex(el, re) {
    const opt = Array.from(el.options).find((o) => re.test(o.text));
    if (!opt) return false;
    el.value = opt.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function radioLabel(r) {
    const l = (r.labels && r.labels[0] && r.labels[0].textContent) || "";
    return (l || r.value || "").toLowerCase();
  }
  function pickRadio(group, match) {
    const r = group.find((x) => match(radioLabel(x)));
    if (!r) return false;
    r.click();
    return true;
  }

  let filled = 0;
  let skipped = 0;

  // Sensitive value resolution from stored answers (opt-in).
  function answerFor(desc) {
    if (WORK_AUTH.test(desc)) return answers.workAuthorized || null; // "Yes"/"No"
    if (SPONSOR.test(desc)) return answers.needsSponsorship || null;
    if (DEMO.test(desc)) return answers.eeoDecline ? "__decline__" : null;
    return undefined; // not sensitive
  }

  // 1) Radio groups (work auth / sponsorship / EEO are often radios).
  const radios = Array.from(document.querySelectorAll("input[type=radio]"));
  const groups = {};
  for (const r of radios) (groups[r.name || r.id] = groups[r.name || r.id] || []).push(r);
  const handledNames = new Set();
  for (const name of Object.keys(groups)) {
    const group = groups[name];
    if (group.some((r) => r.checked || r.disabled)) {
      handledNames.add(name);
      continue;
    }
    const desc = describe(group[0]);
    if (HARD_SKIP.test(desc)) {
      handledNames.add(name);
      skipped++;
      continue;
    }
    const ans = answerFor(desc);
    if (ans === undefined) continue; // not sensitive; leave radios alone
    handledNames.add(name);
    if (!ans) {
      skipped++;
      continue;
    }
    const ok = ans === "__decline__" ? pickRadio(group, (l) => DECLINE.test(l)) : pickRadio(group, (l) => l.includes(ans.toLowerCase()));
    ok ? filled++ : skipped++;
  }

  // 2) Inputs / textareas / selects.
  for (const el of document.querySelectorAll("input, textarea, select")) {
    if (el.type === "hidden" || el.type === "password" || el.type === "radio" || el.type === "checkbox" || el.disabled) continue;
    if (el.type === "radio" && handledNames.has(el.name)) continue;
    if (el.tagName !== "SELECT" && el.value) continue; // don't clobber what's there
    const desc = describe(el);
    if (!desc) continue;
    if (HARD_SKIP.test(desc)) {
      skipped++;
      continue;
    }
    const ans = answerFor(desc);
    if (ans !== undefined) {
      // sensitive field
      if (!ans) {
        skipped++;
        continue;
      }
      let ok = false;
      if (el.tagName === "SELECT") {
        ok = ans === "__decline__" ? selectByRegex(el, DECLINE) : setSelect(el, ans);
      } else if (ans !== "__decline__") {
        setInput(el, ans);
        ok = true;
      }
      ok ? filled++ : skipped++;
      continue;
    }
    // normal fields
    for (const [key, re, typeCheck] of RULES) {
      const value = values[key];
      if (!value) continue;
      if (re.test(desc) || (typeCheck && typeCheck(el))) {
        const ok = el.tagName === "SELECT" ? setSelect(el, value) : (setInput(el, value), true);
        if (ok) filled++;
        break;
      }
    }
  }
  return { filled, skipped };
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
    const { answers } = await chrome.storage.local.get("answers");
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillFormInPage,
      args: [autofillValues(profile), answers || {}],
    });
    const { filled = 0, skipped = 0 } = (res && res.result) || {};
    if (!filled && !skipped) {
      setStatus("No matching fields found on this page.", true);
      return;
    }
    const note = skipped ? ` Left ${skipped} sensitive field${skipped > 1 ? "s" : ""} for you.` : "";
    setStatus(`Filled ${filled} field${filled === 1 ? "" : "s"}.${note} Review before submitting.`, false);
  } catch (err) {
    setStatus(err && err.message ? err.message : "Autofill failed.", true);
  }
}

// Inline generation: write a letter for the scored job, in the panel.
async function genLetter(kind) {
  if (!currentJob) return;
  const profile = await getCachedProfile();
  if (!profile) {
    show("connect");
    return;
  }
  els.genOut.classList.add("hidden");
  els.genCopy.classList.add("hidden");
  els.genStatus.textContent = "Writing…";
  try {
    const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/letters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, job: currentJob, kind }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.text) throw new Error(data.error || `Failed (${res.status}).`);
    els.genStatus.textContent = "";
    els.genOut.textContent = data.text;
    els.genOut.classList.remove("hidden");
    els.genCopy.classList.remove("hidden");
  } catch (err) {
    els.genStatus.textContent = err && err.message ? err.message : "Failed.";
  }
}

function resetGen() {
  if (!els.genOut) return;
  els.genOut.classList.add("hidden");
  els.genOut.textContent = "";
  els.genCopy.classList.add("hidden");
  els.genStatus.textContent = "";
}

async function tailorInOfferBen() {
  if (!currentJob) return;
  const job = { ...currentJob, url: lastUrl || "", source: currentJob.source || "extension" };
  const base = appUrl.replace(/\/+$/, "");
  // Hand the job off via a short token, not the full JD in the URL (that
  // overflowed header limits → HTTP 431).
  try {
    const res = await fetch(`${base}/api/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) throw new Error(data.error || "Handoff failed.");
    await chrome.tabs.create({ url: `${base}/?h=${data.id}` });
  } catch (err) {
    setStatus(err && err.message ? err.message : "Couldn't open OfferBen.", true);
  }
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

// Cheap, AI-free: detect the job on the current page and show it, but DON'T
// score until the user clicks (or auto-score is on). Renders a cached score if
// we already scored this URL.
async function previewJob() {
  const tab = await getActiveTab();
  const url = tab?.url || "";
  toggleScoreBtn(false);
  toggleImportBtn(false);
  if (!tab || !tab.id || /^(chrome|edge|about|chrome-extension):/.test(url)) {
    setJobLine(null);
    setStatus("Open a job posting, then click Score.");
    return;
  }
  if (isOwnApp(url)) {
    setJobLine(null);
    setStatus("You're in the OfferBen app. Open a job posting in another tab to score it.");
    return;
  }
  if (isLinkedInProfile(url)) {
    setJobLine(null);
    setStatus("On a LinkedIn profile. Import it to build your OfferBen profile.");
    toggleImportBtn(true);
    return;
  }
  if (matchCache[url]) {
    lastUrl = url;
    currentJob = matchCache[url].job;
    setJobLine(currentJob);
    renderMatch(matchCache[url].match);
    return;
  }
  const profile = await getCachedProfile();
  const job = await readJob({ silent: true, allowVision: false }); // DOM only, no AI
  if (job) {
    currentJob = job;
    lastUrl = url;
    setJobLine(job);
  }
  if (!profile) {
    show("connect");
    toggleScoreBtn(false);
    return;
  }
  setStatus(job ? "Ready — click Score to rate this job." : "No job detected here. Open a posting, then Score.");
  toggleScoreBtn(true);
}

function toggleScoreBtn(showIt) {
  if (els.scoreBtn) els.scoreBtn.classList.toggle("hidden", !showIt);
}

// --- as the user moves between pages: auto-score only if the toggle is on ----

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab?.url && tab.url !== lastUrl) autoScore ? run({ silent: true }) : previewJob();
});
chrome.tabs.onUpdated.addListener((_id, info, tab) => {
  if (info.status === "complete" && tab.active && tab.url !== lastUrl) {
    autoScore ? run({ silent: true }) : previewJob();
  }
});

async function init() {
  const stored = await chrome.storage.local.get(["appUrl", "autoScore"]);
  appUrl = stored.appUrl || DEFAULT_APP_URL;
  autoScore = Boolean(stored.autoScore);
  els.appUrl.value = appUrl;
  if (els.autoScore) els.autoScore.checked = autoScore;
  await loadCache();

  els.reread.addEventListener("click", () => run({ force: true }));
  els.scoreBtn.addEventListener("click", () => run({ force: true }));
  els.importLi.addEventListener("click", importLinkedIn);
  els.open.addEventListener("click", tailorInOfferBen);
  document.getElementById("gen-cover").addEventListener("click", () => genLetter("coverLetter"));
  document.getElementById("gen-recruiter").addEventListener("click", () => genLetter("recruiterEmail"));
  document.getElementById("gen-referral").addEventListener("click", () => genLetter("referralNote"));
  els.genCopy.addEventListener("click", () => {
    navigator.clipboard.writeText(els.genOut.textContent || "").catch(() => {});
    els.genCopy.textContent = "Copied!";
    setTimeout(() => (els.genCopy.textContent = "Copy"), 1500);
  });
  document.getElementById("autofill").addEventListener("click", autofill);
  els.connectBtn.addEventListener("click", doConnect);
  els.resync.addEventListener("click", doConnect);
  els.appUrl.addEventListener("change", () => {
    appUrl = els.appUrl.value.trim() || DEFAULT_APP_URL;
    chrome.storage.local.set({ appUrl });
  });
  els.autoScore.addEventListener("change", () => {
    autoScore = els.autoScore.checked;
    chrome.storage.local.set({ autoScore });
    if (autoScore) run({ force: true });
  });

  // Application answers (opt-in; autofill only fills what's set here).
  const { answers } = await chrome.storage.local.get("answers");
  const a = answers || {};
  els.ansWorkauth.value = a.workAuthorized || "";
  els.ansSponsor.value = a.needsSponsorship || "";
  els.ansEeo.checked = Boolean(a.eeoDecline);
  const saveAnswers = () =>
    chrome.storage.local.set({
      answers: {
        workAuthorized: els.ansWorkauth.value,
        needsSponsorship: els.ansSponsor.value,
        eeoDecline: els.ansEeo.checked,
      },
    });
  els.ansWorkauth.addEventListener("change", saveAnswers);
  els.ansSponsor.addEventListener("change", saveAnswers);
  els.ansEeo.addEventListener("change", saveAnswers);

  // Default: just detect + show the job; score on click. (Auto-score if enabled.)
  if (autoScore) await run();
  else await previewJob();
}

document.addEventListener("DOMContentLoaded", init);
