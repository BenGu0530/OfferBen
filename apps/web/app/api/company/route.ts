import { createAIProvider, researchCompany, type CompanyBrief } from "@offerben/core";
import { aiConfigFromHeaders, jsonHandler } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  company: string;
  jobUrl?: string;
  /** The job description, used only to disambiguate same-name companies. */
  jobText?: string;
}

/**
 * Researching a company costs a page crawl AND an AI call, and the free Gemini
 * tier is ~20 calls/day — so a brief is cached per company for the process
 * lifetime. Two roles at the same company should never cost two calls.
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 100;
const cache = new Map<string, { at: number; brief: CompanyBrief }>();

function cacheGet(key: string): CompanyBrief | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  // Refresh insertion order so the LRU eviction below keeps what's in use.
  cache.delete(key);
  cache.set(key, hit);
  return hit.brief;
}

function cacheSet(key: string, brief: CompanyBrief): void {
  cache.set(key, { at: Date.now(), brief });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export const POST = jsonHandler<Body>(async (body, req) => {
  const company = String(body.company || "").trim();
  if (!company) throw new Error("A company name is required.");

  const key = company.toLowerCase();
  const cached = cacheGet(key);
  if (cached) return { brief: cached, cached: true };

  const ai = createAIProvider(aiConfigFromHeaders(req));
  const brief = await researchCompany(ai, {
    company,
    jobUrl: body.jobUrl,
    jobText: String(body.jobText || "").slice(0, 8000),
  });
  cacheSet(key, brief);
  return { brief, cached: false };
});
