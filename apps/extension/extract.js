// Injected into the active tab by the popup. Returns a captured job object.
// Self-contained: this whole file is one IIFE whose value is the result.
(() => {
  const clean = (s) => (s || "").replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();

  const text = (el) => (el ? clean(el.innerText || el.textContent || "") : "");

  const firstText = (selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const t = text(el);
      if (t) return t;
    }
    return "";
  };

  const meta = (name) => {
    const el =
      document.querySelector(`meta[property="${name}"]`) ||
      document.querySelector(`meta[name="${name}"]`);
    return el ? clean(el.getAttribute("content") || "") : "";
  };

  const host = location.hostname;

  // --- Site adapters ---------------------------------------------------------
  const adapters = [
    {
      id: "greenhouse",
      match: () => /greenhouse\.io/.test(host),
      run: () => ({
        title: firstText([".app-title", ".job__title h1", "h1.section-header", "h1"]),
        company: firstText([".company-name", "header .company"]),
        description: firstText(["#content", ".job__description", "#job_description"]),
      }),
    },
    {
      id: "lever",
      match: () => /lever\.co/.test(host),
      run: () => ({
        title: firstText([".posting-headline h2", "h2"]),
        company: firstText([".main-header-logo img"]) || "",
        description: firstText(['[data-qa="job-description"]', ".section-wrapper", ".content"]),
      }),
    },
    {
      id: "ashby",
      match: () => /ashbyhq\.com/.test(host),
      run: () => ({
        title: firstText(["h1"]),
        company: "",
        description: firstText(['[class*="JobDescription"]', "main", "article"]),
      }),
    },
    {
      id: "workday",
      match: () => /myworkdayjobs\.com|workday/.test(host),
      run: () => ({
        title: firstText(['[data-automation-id="jobPostingHeader"]', "h1", "h2"]),
        company: "",
        description: firstText(['[data-automation-id="jobPostingDescription"]', "main"]),
      }),
    },
  ];

  // --- Generic fallback ------------------------------------------------------
  const generic = () => {
    const title =
      firstText(["h1"]) || meta("og:title") || clean(document.title.split(/[|\-–]/)[0]);

    // Pick the densest text container as the description.
    const candidates = Array.from(
      document.querySelectorAll("article, main, [class*='description'], [id*='description'], section"),
    );
    let best = "";
    for (const el of candidates) {
      const t = text(el);
      if (t.length > best.length) best = t;
    }
    if (best.length < 200) best = text(document.body);

    return { title, company: meta("og:site_name"), description: best };
  };

  const adapter = adapters.find((a) => a.match());
  const result = adapter ? adapter.run() : generic();

  // Fill gaps from generic if an adapter missed something.
  if (!result.description || result.description.length < 120) {
    const g = generic();
    if (g.description.length > (result.description || "").length) {
      result.description = g.description;
    }
    if (!result.title) result.title = g.title;
    if (!result.company) result.company = g.company;
  }

  // Last-resort company guess from hostname (e.g. acme.greenhouse.io -> Acme).
  if (!result.company) {
    const sub = host.split(".")[0];
    if (sub && !["www", "jobs", "boards", "job-boards", "careers"].includes(sub)) {
      result.company = sub.charAt(0).toUpperCase() + sub.slice(1);
    }
  }

  return {
    title: clean(result.title).slice(0, 200),
    company: clean(result.company).slice(0, 120),
    description: clean(result.description).slice(0, 20000),
    url: location.href,
    source: adapter ? adapter.id : "generic",
  };
})();
