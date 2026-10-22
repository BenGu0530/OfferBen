import { z } from "zod";
import { SkillGroupSchema, type Library, type LibraryEntry } from "../schema/library";

/**
 * A resume DOCUMENT: which library entries appear, in which sections, with
 * which bullets. Bullets cite the library facts they're built from, which is
 * what lets code (not just the prompt) refuse fabricated content.
 *
 * Plain data — the client can toggle sections and reorder without touching the
 * core runtime; the server re-validates and re-renders.
 */

export const SECTION_KEYS = [
  "education",
  "experience",
  "research",
  "projects",
  "publications",
  "demos",
  "talks",
  "awards",
  "skills",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const ARCHETYPES = ["research", "industry", "entertainment", "general"] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const SECTION_TITLES: Record<SectionKey, string> = {
  education: "EDUCATION",
  experience: "EXPERIENCE",
  research: "RESEARCH",
  projects: "PROJECTS",
  publications: "PUBLICATIONS",
  demos: "PUBLIC DEMOS",
  talks: "PRESENTATIONS",
  awards: "AWARDS",
  skills: "SKILLS",
};

export const ResumeBulletSchema = z.object({
  /** May contain ONE **bold** span and $math$; everything else is escaped. */
  text: z.string().default(""),
  factIds: z.array(z.string()).default([]),
});
export type ResumeBullet = z.infer<typeof ResumeBulletSchema>;

export const ResumeChildSchema = z.object({
  entryId: z.string().default(""),
  bullets: z.array(ResumeBulletSchema).default([]),
});
export type ResumeChild = z.infer<typeof ResumeChildSchema>;

export const ResumeItemSchema = ResumeChildSchema.extend({
  /** Projects shown under a lab/company header (two-level layout). */
  children: z.array(ResumeChildSchema).default([]),
});
export type ResumeItem = z.infer<typeof ResumeItemSchema>;

export const ResumeSectionSchema = z.object({
  key: z.enum(SECTION_KEYS).catch("projects"),
  items: z.array(ResumeItemSchema).default([]),
});
export type ResumeSection = z.infer<typeof ResumeSectionSchema>;

export const ResumeDocSchema = z.object({
  archetype: z.enum(ARCHETYPES).catch("general"),
  sections: z.array(ResumeSectionSchema).default([]),
  /** Selected + ordered skills; empty = use the library's as-is. */
  skills: z.array(SkillGroupSchema).default([]),
  /** Why the model chose this shape (shown in the UI). */
  notes: z.array(z.string()).default([]),
});
export type ResumeDoc = z.infer<typeof ResumeDocSchema>;

/** Canonical section order per archetype, used when a section is toggled on. */
export const SECTION_ORDER: Record<Archetype, SectionKey[]> = {
  research: [
    "education",
    "research",
    "publications",
    "experience",
    "projects",
    "talks",
    "demos",
    "awards",
    "skills",
  ],
  industry: [
    "education",
    "experience",
    "research",
    "projects",
    "demos",
    "publications",
    "talks",
    "awards",
    "skills",
  ],
  entertainment: [
    "education",
    "experience",
    "demos",
    "research",
    "projects",
    "publications",
    "talks",
    "awards",
    "skills",
  ],
  general: [
    "education",
    "experience",
    "research",
    "projects",
    "publications",
    "demos",
    "talks",
    "awards",
    "skills",
  ],
};

const visible = (lib: Library) => lib.entries.filter((e) => !e.hidden);

/** Which section an entry naturally lives in (children are rendered under their parent). */
export function homeSection(e: LibraryEntry, lib: Library): SectionKey | null {
  switch (e.kind) {
    case "education":
      return "education";
    case "position":
      return e.section === "research" ? "research" : "experience";
    case "project": {
      const parent = e.parentId ? lib.entries.find((p) => p.id === e.parentId) : undefined;
      return parent && parent.kind === "position" ? null : "projects";
    }
    case "publication":
      return "publications";
    case "demo":
      return "demos";
    case "talk":
      return "talks";
    case "award":
      return "awards";
  }
}

/**
 * Bold the first result-like token ("96%", "1.8×", "<2 cm") so the no-AI resume
 * follows the same one-bold-per-bullet rule as the curated one.
 */
export function autoBold(s: string): string {
  if (s.includes("**")) return s;
  const m = s.match(/[<>~≈]?\d+(?:\.\d+)?\s?(?:%|×|x\b|cm\b|mm\b|ms\b|Hz\b|kg\b)/);
  if (!m || m.index === undefined) return s;
  return `${s.slice(0, m.index)}**${m[0]}**${s.slice(m.index + m[0].length)}`;
}

const factBullets = (e: LibraryEntry) =>
  e.facts.map((f) => ({ text: autoBold(f.text), factIds: [f.id] }));

/** Default items for one section: every visible entry that lives there, library order. */
export function defaultItems(lib: Library, key: SectionKey): ResumeItem[] {
  if (key === "skills") return [];
  return visible(lib)
    .filter((e) => homeSection(e, lib) === key)
    .map((e) => ({
      entryId: e.id,
      bullets: factBullets(e),
      children: visible(lib)
        .filter((c) => c.parentId === e.id && c.kind === "project")
        .map((c) => ({ entryId: c.id, bullets: factBullets(c) })),
    }));
}

/**
 * The no-AI resume: everything visible, facts verbatim, publications/demos/talks
 * inlined under their project. Costs zero AI calls — the baseline the user can
 * always fall back to.
 */
export function defaultDoc(lib: Library): ResumeDoc {
  const keys: SectionKey[] = [
    "education",
    "experience",
    "research",
    "projects",
    "awards",
    "skills",
  ];
  return {
    archetype: "general",
    sections: keys
      .map((key) => ({ key, items: defaultItems(lib, key) }))
      .filter((s) => s.key === "skills" || s.items.length > 0),
    skills: [],
    notes: [],
  };
}

/**
 * Turn sections on/off. Kept sections keep their (possibly AI-curated) items;
 * newly enabled ones get defaults, restricted to children of what's already on
 * the page where that makes sense (publications of the shown projects, etc.).
 */
export function applySectionSet(doc: ResumeDoc, lib: Library, keys: SectionKey[]): ResumeDoc {
  const want = new Set(keys);
  const kept = doc.sections.filter((s) => want.has(s.key));
  const shownIds = new Set<string>();
  for (const s of kept) {
    for (const it of s.items) {
      shownIds.add(it.entryId);
      for (const c of it.children) shownIds.add(c.entryId);
    }
  }
  const order = SECTION_ORDER[doc.archetype];
  const sections = [...kept];
  for (const key of order) {
    if (!want.has(key) || sections.some((s) => s.key === key)) continue;
    let items = defaultItems(lib, key);
    if (key === "publications" || key === "demos" || key === "talks") {
      const related = items.filter((it) => {
        const e = lib.entries.find((x) => x.id === it.entryId);
        return e && (!e.parentId || shownIds.has(e.parentId));
      });
      if (related.length) items = related;
    }
    // Insert at its canonical position relative to sections already present.
    const rank = (k: SectionKey) => order.indexOf(k);
    const at = sections.findIndex((s) => rank(s.key) > rank(key));
    const sec = { key, items };
    if (at === -1) sections.push(sec);
    else sections.splice(at, 0, sec);
  }
  return { ...doc, sections };
}
