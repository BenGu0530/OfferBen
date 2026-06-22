const DEFAULT_APP_URL = "http://localhost:3000";

const els = {
  status: document.getElementById("status"),
  captured: document.getElementById("captured"),
  title: document.getElementById("f-title"),
  company: document.getElementById("f-company"),
  desc: document.getElementById("f-desc"),
  charcount: document.getElementById("charcount"),
  open: document.getElementById("open"),
  recapture: document.getElementById("recapture"),
  appUrl: document.getElementById("app-url"),
};

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle("error", isError);
  els.status.classList.remove("hidden");
  els.captured.classList.add("hidden");
}

function showCaptured(job) {
  els.status.classList.add("hidden");
  els.captured.classList.remove("hidden");
  els.title.value = job.title || "";
  els.company.value = job.company || "";
  els.desc.value = job.description || "";
  updateCount();
}

function updateCount() {
  els.charcount.textContent = `${els.desc.value.length} chars`;
}

// base64url encoding of a UTF-8 string (mirrors lib/handoff.ts decoder)
function toBase64Url(str) {
  const utf8 = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
  return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function capture() {
  setStatus("Reading the page…");
  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) throw new Error("No active tab.");
    if (/^(chrome|edge|about|chrome-extension):/.test(tab.url || "")) {
      throw new Error("Open a job posting page first.");
    }

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["extract.js"],
    });

    const job = injection && injection.result;
    if (!job || !job.description || job.description.length < 60) {
      throw new Error("Couldn't find a job description on this page.");
    }
    showCaptured(job);
  } catch (err) {
    setStatus(err && err.message ? err.message : "Capture failed.", true);
  }
}

async function openInOfferBen() {
  const job = {
    title: els.title.value.trim(),
    company: els.company.value.trim(),
    description: els.desc.value.trim(),
    url: (await getActiveTab())?.url || "",
    source: "extension",
  };
  if (!job.description) {
    setStatus("Description is empty.", true);
    return;
  }

  const base = (els.appUrl.value.trim() || DEFAULT_APP_URL).replace(/\/+$/, "");
  const payload = toBase64Url(JSON.stringify(job));
  const url = `${base}/?job=${payload}`;

  await chrome.storage.local.set({ appUrl: base });
  await chrome.tabs.create({ url });
  window.close();
}

async function init() {
  const { appUrl } = await chrome.storage.local.get("appUrl");
  els.appUrl.value = appUrl || DEFAULT_APP_URL;

  els.desc.addEventListener("input", updateCount);
  els.open.addEventListener("click", openInOfferBen);
  els.recapture.addEventListener("click", capture);
  els.appUrl.addEventListener("change", () =>
    chrome.storage.local.set({ appUrl: els.appUrl.value.trim() }),
  );

  await capture();
}

document.addEventListener("DOMContentLoaded", init);
