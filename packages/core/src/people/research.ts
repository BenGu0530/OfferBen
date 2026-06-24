import { z } from "zod";
import type { AIProvider } from "../ai/provider";

/**
 * Research a person (a hiring manager, prospective referrer, professor, or tech
 * lead) from CLEAN, OFFICIAL scholarly APIs only — no scraping.
 *
 * Source: OpenAlex (https://openalex.org), a free open catalog of scholarly
 * works and authors. No API key; we send a `mailto` to use the polite pool.
 *
 * What we can do compliantly: schools/affiliations over time, the labs/
 * institutions they've worked at, their publications, and — via the LLM — an
 * inferred "research taste" + outreach talking points.
 *
 * What we deliberately DON'T do: LinkedIn likes/comments/post interactions.
 * There is no compliant API for that; scraping it violates ToS and risks bans
 * (the exact thing OfferBen avoids). Taste is inferred from real publications.
 */

const OA = "https://api.openalex.org";
const MAILTO = process.env.OPENALEX_MAILTO || "offerben@users.noreply.github.com";

function authorKey(id: string): string {
  return id.split("/").pop() || id; // "https://openalex.org/A123" -> "A123"
}

export interface AuthorCandidate {
  id: string;
  name: string;
  institution?: string;
  worksCount: number;
  citedBy: number;
  topics: string[];
}

export interface Affiliation {
  institution: string;
  years: number[];
}

export interface PublicationLite {
  title: string;
  year?: number;
  venue?: string;
  citedBy: number;
  abstract?: string;
}

export interface AuthorDossier {
  id: string;
  name: string;
  worksCount: number;
  citedBy: number;
  hIndex?: number;
  topics: string[];
  affiliations: Affiliation[];
  publications: PublicationLite[];
}

export interface ResearchTaste {
  themes: string[];
  methods: string[];
  venues: string[];
  trajectory: string;
  talkingPoints: string[];
}

/** Disambiguate by name; if `institution` is given, prioritize matches there. */
export async function searchAuthors(
  query: string,
  institution?: string,
): Promise<AuthorCandidate[]> {
  let instId: string | undefined;
  if (institution?.trim()) {
    const r = await fetch(
      `${OA}/institutions?search=${encodeURIComponent(institution)}&per_page=1&mailto=${MAILTO}`,
    );
    if (r.ok) {
      const j = (await r.json()) as { results?: Array<{ id: string }> };
      instId = j.results?.[0]?.id ? authorKey(j.results[0].id) : undefined;
    }
  }

  const params = new URLSearchParams({ search: query, per_page: "8", mailto: MAILTO });
  if (instId) params.set("filter", `last_known_institutions.id:${instId}`);
  const res = await fetch(`${OA}/authors?${params}`);
  if (!res.ok) throw new Error(`Author search failed (${res.status}).`);
  const data = (await res.json()) as { results?: any[] };

  return (data.results ?? []).map((a) => ({
    id: authorKey(a.id),
    name: a.display_name,
    institution: (a.last_known_institutions ?? [])[0]?.display_name,
    worksCount: a.works_count ?? 0,
    citedBy: a.cited_by_count ?? 0,
    topics: (a.topics ?? []).slice(0, 4).map((t: any) => t.display_name),
  }));
}

function reconstructAbstract(inv?: Record<string, number[]>): string | undefined {
  if (!inv) return undefined;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(inv)) {
    for (const pos of positions) words[pos] = word;
  }
  const text = words.filter(Boolean).join(" ").trim();
  return text ? text.slice(0, 600) : undefined;
}

/** Full dossier: affiliations timeline + top-cited publications. */
export async function getAuthorDossier(authorId: string): Promise<AuthorDossier> {
  const id = authorKey(authorId);
  const aRes = await fetch(`${OA}/authors/${id}?mailto=${MAILTO}`);
  if (!aRes.ok) throw new Error(`Author lookup failed (${aRes.status}).`);
  const a = (await aRes.json()) as any;

  const affiliations: Affiliation[] = (a.affiliations ?? [])
    .map((af: any) => ({
      institution: af.institution?.display_name as string,
      years: (af.years ?? []) as number[],
    }))
    .filter((x: Affiliation) => x.institution)
    .slice(0, 8);

  const wRes = await fetch(
    `${OA}/works?filter=author.id:${id}&sort=cited_by_count:desc&per_page=12` +
      `&select=title,publication_year,primary_location,cited_by_count,abstract_inverted_index&mailto=${MAILTO}`,
  );
  const wData = wRes.ok ? ((await wRes.json()) as { results?: any[] }) : { results: [] };
  const publications: PublicationLite[] = (wData.results ?? []).map((w) => ({
    title: w.title ?? "Untitled",
    year: w.publication_year,
    venue: w.primary_location?.source?.display_name,
    citedBy: w.cited_by_count ?? 0,
    abstract: reconstructAbstract(w.abstract_inverted_index),
  }));

  return {
    id,
    name: a.display_name,
    worksCount: a.works_count ?? 0,
    citedBy: a.cited_by_count ?? 0,
    hIndex: a.summary_stats?.h_index,
    topics: (a.topics ?? []).slice(0, 6).map((t: any) => t.display_name),
    affiliations,
    publications,
  };
}

const TasteSchema = z.object({
  themes: z.array(z.string()).default([]),
  methods: z.array(z.string()).default([]),
  venues: z.array(z.string()).default([]),
  trajectory: z.string().default(""),
  talkingPoints: z.array(z.string()).default([]),
});

const SYSTEM =
  "You analyze a researcher's publication record and summarize their research taste " +
  "for someone preparing to reach out (a referral note, cold email, or interview). " +
  "Be specific and grounded only in the provided works; never invent papers.";

const SCHEMA_HINT = `{
  "themes": [string],        // recurring research themes / problems they care about
  "methods": [string],       // methods/tools/approaches they favor
  "venues": [string],        // venues they publish in
  "trajectory": string,      // 2-3 sentences on how their focus has evolved
  "talkingPoints": [string]  // concrete, specific things to mention when reaching out
}`;

/** Infer "research taste" + outreach talking points from the dossier (LLM). */
export async function synthesizeResearchTaste(
  ai: AIProvider,
  dossier: AuthorDossier,
): Promise<ResearchTaste> {
  const pubs = dossier.publications
    .slice(0, 10)
    .map((p) => `- (${p.year ?? "?"}, ${p.venue ?? "?"}, ${p.citedBy} cites) ${p.title}${p.abstract ? `\n    ${p.abstract.slice(0, 240)}` : ""}`)
    .join("\n");
  const prompt = [
    `Researcher: ${dossier.name}`,
    `Fields: ${dossier.topics.join(", ")}`,
    `Affiliations: ${dossier.affiliations.map((x) => x.institution).join("; ")}`,
    "",
    "Selected publications (most cited):",
    pubs,
  ].join("\n");

  return ai.generateJSON(
    { system: SYSTEM, prompt, schemaHint: SCHEMA_HINT, temperature: 0.3 },
    (raw) => TasteSchema.parse(raw),
  );
}
