import type { AIProvider } from "../ai/provider";
import { CompanyBriefSchema, type CompanyBrief } from "../schema/company";

/**
 * Research a company from ITS OWN public website, so a cover letter can name a
 * real product instead of praising "your innovative solutions".
 *
 * Scope is deliberately narrow (see CLAUDE.md invariant #4): one company at a
 * time, user-initiated, a handful of pages off the company's own marketing site.
 * We do NOT fetch job boards, LinkedIn, or anything gated — the no-scraping line
 * still holds for those.
 *
 * Shape: resolve homepage -> fetch a few product/about pages -> ONE AI call that
 * distills them into a CompanyBrief. Callers should cache the brief per company;
 * on a small free tier that AI call is the expensive part.
 */

const UA = "OfferBen/0.2 (+https://github.com/offerben; personal job-application assistant)";
const PAGE_TIMEOUT_MS = 6000;
const MAX_PAGES = 4;
const MAX_CHARS_PER_PAGE = 12000;
const MAX_CHARS_TOTAL = 30000;

/** Hosts that are job boards, not companies — never treat these as a homepage. */
const JOB_HOSTS =
  /(greenhouse|lever|workday|myworkdayjobs|ashbyhq|smartrecruiters|jobvite|icims|taleo|bamboohr|breezy|workable|rippling|joinhandshake|handshake|linkedin|indeed|glassdoor|ziprecruiter|wellfound|angel|builtin|dice|monster|simplyhired)\./i;

/** Legal/filler tokens that are never part of a domain. */
const NOISE = new Set([
  "inc", "inc.", "llc", "ltd", "ltd.", "limited", "corp", "corp.", "corporation",
  "co", "co.", "company", "gmbh", "plc", "sa", "ag", "bv", "nv", "pte", "pty",
  "holdings", "group", "the", "labs", "lab",
]);

const TLDS = [".com", ".ai", ".io", ".co", ".tech", ".dev", ".org"];

/** Trailing words that are really the TLD in disguise: "Figure AI" -> figure.ai. */
const TLD_WORDS = new Set(["ai", "io", "dev", "app", "tech", "cloud", "xyz", "sh", "ml", "bio"]);

/** Parked / for-sale pages pass a naive name check ("nimo.ai for sale") but say
 *  nothing about a company. Reject them outright. */
const PARKED =
  /(domain (name )?(is )?for sale|buy this domain|this domain is parked|parked (free )?(at|by)|inquire about this domain|sedo\.com|hugedomains|afternic|dan\.com|spaceship\.com|domain broker|make an offer on this domain)/i;

function tokens(company: string): string[] {
  return company
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t && !NOISE.has(t));
}

interface Candidate {
  host: string;
  /** How much the DOMAIN SHAPE alone suggests this is the company's own site. */
  prior: number;
}

/**
 * Candidate hostnames with a prior. Shape matters a lot: `figureai.com` and
 * `figure.ai` are far better bets for "Figure AI" than `figure.com`, which is a
 * different company entirely — so the leading-word guess gets almost no prior and
 * only wins when the page text strongly confirms it.
 */
export function candidateHosts(company: string, jobUrl?: string): Candidate[] {
  const t = tokens(company);
  if (!t.length) return [];

  const out: Candidate[] = [];
  const push = (host: string, prior: number) => {
    if (!out.some((c) => c.host === host)) out.push({ host, prior });
  };

  // An ATS URL usually embeds the company's own slug (boards.greenhouse.io/acme),
  // which beats guessing from a display name like "Acme Technology Inc.".
  const ats = atsSlug(jobUrl);
  if (ats && ats.length >= 2) for (const tld of TLDS) push(ats + tld, tld === ".com" ? 4 : 3);

  const joined = t.join("");
  if (joined.length >= 2) for (const tld of TLDS) push(joined + tld, tld === ".com" ? 3 : 2);

  // "Figure AI" -> figure.ai, "Skild AI" -> skild.ai. Ranked ABOVE joined+.com:
  // this is how these companies actually name themselves, and the joined form
  // (skildai.com) is a favourite of unrelated squatters and namesakes.
  const last = t[t.length - 1];
  if (t.length > 1 && TLD_WORDS.has(last)) {
    const stem = t.slice(0, -1).join("");
    if (stem.length >= 2) push(`${stem}.${last}`, 4);
  }

  // Leading word alone — the most collision-prone guess, so barely any prior.
  if (t.length > 1 && t[0].length >= 3) {
    for (const tld of TLDS) push(t[0] + tld, tld === ".com" ? 1 : 0);
  }
  return out;
}

function atsSlug(jobUrl?: string): string | undefined {
  if (!jobUrl) return undefined;
  try {
    const u = new URL(jobUrl);
    if (!JOB_HOSTS.test(u.hostname)) return undefined;
    // boards.greenhouse.io/acme/jobs/123, jobs.lever.co/acme/uuid
    const seg = u.pathname.split("/").filter(Boolean)[0];
    if (seg && /^[a-z0-9-]{2,40}$/i.test(seg) && !/^(jobs?|careers?|en|us)$/i.test(seg)) {
      return seg.toLowerCase().replace(/-/g, "");
    }
    // acme.greenhouse.io -> acme
    const sub = u.hostname.split(".")[0];
    return /^(boards|jobs|careers|www|apply)$/i.test(sub) ? undefined : sub.toLowerCase();
  } catch {
    return undefined;
  }
}

async function getText(url: string): Promise<{ url: string; html: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    if (!/text\/html/i.test(res.headers.get("content-type") || "")) return null;
    return { url: res.url || url, html: await res.text() };
  } catch {
    return null;
  }
}

/** Crude but dependency-free HTML -> text. Good enough to feed a summarizer. */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|section|tr|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n")
    .trim();
}

/** Words too common in any job ad or web page to identify anything. */
const STOPWORDS = new Set([
  "experience", "engineering", "engineer", "engineers", "candidate", "candidates",
  "opportunity", "employer", "applicants", "benefits", "including", "required",
  "preferred", "qualifications", "responsibilities", "position", "provide",
  "working", "together", "company", "companies", "business", "customer",
  "customers", "product", "products", "platform", "solutions", "software",
  "technology", "technologies", "innovative", "passionate", "development",
  "developing", "building", "through", "across", "within", "should", "please",
  "person", "people", "salary", "remote", "hybrid", "office", "contact", "apply",
]);

/** Distinctive vocabulary from the job ad — the technical nouns a real company
 *  site would echo ("manipulation", "teleoperation", "sim-to-real"). */
function distinctiveTerms(jobText: string): string[] {
  const counts = new Map<string, number>();
  for (const w of jobText.toLowerCase().match(/[a-z][a-z-]{5,}/g) || []) {
    if (STOPWORDS.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([w]) => w);
}

/**
 * Does this site talk about the same things the job ad does? This is what
 * separates two companies that share a name: for a robotics JD, skild.ai echoes
 * it heavily and skildai.com (market-research infra) barely at all. 0-3.
 */
function jobOverlap(text: string, terms: string[]): number {
  if (terms.length < 8) return 0; // too little JD to judge on
  const hay = text.toLowerCase();
  const hits = terms.filter((t) => hay.includes(t)).length;
  return Math.min(3, Math.floor(hits / 4));
}

/**
 * How strongly this page's text says "yes, this is that company". Negative means
 * reject. Keeping this separate from the domain prior is the point: a weak domain
 * with a confirming page should beat a plausible domain with an unrelated one.
 */
export function contentScore(text: string, company: string, jobTerms: string[] = []): number {
  if (PARKED.test(text.slice(0, 4000))) return -1;
  // No length floor: a stealth-mode one-pager ("ReCAST Robotics | Stealth") is
  // still their real site — the brief just comes back thin. The name check below
  // is what rejects blank shells and error pages.

  const t = tokens(company);
  if (!t.length) return -1;
  const hay = text.toLowerCase().slice(0, 8000);
  if (t[0].length < 3 || !hay.includes(t[0])) return -1; // wrong company, full stop

  let score = 1;
  if (hay.includes(t.join(" "))) score += 4; // the full name, verbatim
  else if (t.every((tok) => hay.includes(tok))) score += 2;
  return score + jobOverlap(text, jobTerms);
}

/** Below this we'd rather have no company context than the wrong company's. */
export const MIN_CONFIDENCE = 4;

/**
 * Find the company's homepage. Every candidate is fetched in parallel and SCORED
 * (domain shape + page text); the best wins, and if nothing clears MIN_CONFIDENCE
 * we return null. First-match-wins was how "Figure AI" resolved to figure.com — a
 * mortgage lender — and how "Nimo Technology" landed on a domain-parking page.
 */
export async function resolveCompanySite(
  company: string,
  jobUrl?: string,
  jobText?: string,
): Promise<{ url: string; text: string; html: string } | null> {
  const candidates = candidateHosts(company, jobUrl);
  if (!candidates.length) return null;
  const jobTerms = jobText ? distinctiveTerms(jobText) : [];

  const fetched = await Promise.all(
    candidates.map(async (c) => {
      const r = await getText(`https://${c.host}/`);
      if (!r) return null;
      try {
        if (JOB_HOSTS.test(new URL(r.url).hostname)) return null;
      } catch {
        return null;
      }
      const text = htmlToText(r.html);
      const content = contentScore(text, company, jobTerms);
      if (content < 0) return null;
      return { url: r.url, text, html: r.html, score: c.prior + content };
    }),
  );

  let best = null as { url: string; text: string; html: string; score: number } | null;
  for (const f of fetched) {
    if (f && (!best || f.score > best.score)) best = f;
  }
  return best && best.score >= MIN_CONFIDENCE ? best : null;
}

const INTERESTING = /product|platform|solution|technolog|what-we|what_we|about|mission|research|how-it-works|use-cases?|customers?/i;

/** Same-site links most likely to describe what they build. */
function productLinks(html: string, base: string): string[] {
  const origin = new URL(base).origin;
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 12) {
    const [, href, label] = m;
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      continue;
    }
    if (abs.origin !== origin) continue;
    if (/\.(pdf|jpe?g|png|gif|svg|zip|mp4|webp)$/i.test(abs.pathname)) continue;
    abs.hash = "";
    const key = abs.toString();
    if (key === base || seen.has(key)) continue;
    if (!INTERESTING.test(abs.pathname) && !INTERESTING.test(htmlToText(label))) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export interface CompanyResearchInput {
  company: string;
  /** The job posting URL — used to recover the company's own slug from an ATS host. */
  jobUrl?: string;
  /** The job description — its vocabulary disambiguates same-name companies. */
  jobText?: string;
}

/**
 * Fetch the company's site and distill it into a CompanyBrief. Returns a brief
 * with `website: ""` and empty arrays when the site can't be found — callers
 * should treat that as "no company context" and fall back to the JD alone.
 */
export async function researchCompany(
  ai: AIProvider,
  { company, jobUrl, jobText }: CompanyResearchInput,
): Promise<CompanyBrief> {
  const empty = CompanyBriefSchema.parse({ name: company });

  const home = await resolveCompanySite(company, jobUrl, jobText);
  if (!home) return empty;

  const pages: Array<{ url: string; text: string }> = [
    { url: home.url, text: home.text.slice(0, MAX_CHARS_PER_PAGE) },
  ];
  const links = productLinks(home.html, home.url).slice(0, MAX_PAGES - 1);
  const extra = await Promise.all(links.map((l) => getText(l)));
  for (const r of extra) {
    if (!r) continue;
    pages.push({ url: r.url, text: htmlToText(r.html).slice(0, MAX_CHARS_PER_PAGE) });
  }

  let budget = MAX_CHARS_TOTAL;
  const corpus = pages
    .map(({ url, text }) => {
      const slice = text.slice(0, Math.max(0, budget));
      budget -= slice.length;
      return `--- ${url} ---\n${slice}`;
    })
    .filter((s) => s.trim())
    .join("\n\n");

  if (!corpus.trim()) return { ...empty, website: home.url, sources: [home.url] };

  const brief = await ai.generateJSON(
    {
      system:
        "You distill a company's own website into factual notes a job applicant can cite. " +
        "You never invent product names, customers, funding, or numbers.",
      prompt: [
        `Read the following pages from ${company}'s own website and summarize what they build.`,
        "",
        "Rules:",
        "- Use ONLY what the page text supports. If the site doesn't say, leave the field empty.",
        "- `products`: name the actual products/platforms as the site names them. Marketing",
        "  slogans are not product names — skip them.",
        "- `tech`: concrete technologies/techniques the site names (e.g. specific models,",
        "  hardware, algorithms), not generic words like 'AI' or 'cloud'.",
        "- `recent`: only items the site presents as news/launches/funding/customers.",
        "- Prefer specifics over adjectives everywhere.",
        "",
        "=== PAGES ===",
        corpus,
      ].join("\n"),
      schemaHint: `{ "name": string, "oneLiner": string, "mission": string,
  "products": [{ "name": string, "what": string, "forWho": string }],
  "tech": string[], "differentiators": string[], "recent": string[] }`,
      temperature: 0.2,
    },
    (raw) => CompanyBriefSchema.parse(raw),
  );

  // Trust our own crawl for provenance, not the model's echo of it.
  return { ...brief, name: brief.name || company, website: home.url, sources: pages.map((p) => p.url) };
}

/** True when the brief carries enough substance to be worth putting in a prompt. */
export function briefIsUseful(b: CompanyBrief | null | undefined): boolean {
  if (!b) return false;
  return Boolean(b.oneLiner || b.products.length || b.tech.length || b.differentiators.length);
}
