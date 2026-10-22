import {
  LibrarySchema,
  type Fact,
  type Library,
  type LibraryEntry,
  type Proposal,
  type ProposedEntry,
  type SkillGroup,
} from "../schema/library";
import type { Profile } from "../schema/profile";

/**
 * Pure library operations (no AI, no I/O) so they run anywhere — server today,
 * the extension later — and are unit-testable.
 */

/** Short random id. Uses Web Crypto, available in Node 19+ and every browser. */
export function newId(prefix = "e"): string {
  return `${prefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
}

/** Comparison key: case/punctuation-insensitive, so "Sim-to-Real RL" == "sim to real rl". */
export function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findEntry(lib: Library, id: string): LibraryEntry | undefined {
  return lib.entries.find((e) => e.id === id);
}

export function childrenOf(lib: Library, id: string): LibraryEntry[] {
  return lib.entries.filter((e) => e.parentId === id);
}

/**
 * Compact text outline of the library for prompts: ids + structure + a hint of
 * content, so the model can attach new material to the RIGHT existing entry
 * without us shipping every fact.
 */
export function libraryOutline(lib: Library, factsPerEntry = 2): string {
  if (!lib.entries.length) return "(library is empty)";
  return lib.entries
    .map((e) => {
      const dates = [e.start, e.end].filter(Boolean).join("–") || e.date;
      const head = [
        `[${e.id}]`,
        e.kind + (e.kind === "position" ? `/${e.section}` : ""),
        JSON.stringify(e.title),
        e.org ? `@ ${e.org}` : "",
        dates ? `(${dates})` : "",
        e.parentId ? `parent=${e.parentId}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const facts = e.facts
        .slice(0, factsPerEntry)
        .map((f) => `    - ${f.text.slice(0, 140)}`)
        .join("\n");
      return facts ? `${head}\n${facts}` : head;
    })
    .join("\n");
}

/** Small, safe cleanups of model-written facts: "0.02--1.2 m" -> "0.02–1.2 m". */
export function normalizeFactText(s: string): string {
  return s
    .trim()
    .replace(/(\d)\s*--\s*(\d)/g, "$1–$2")
    .replace(
      /(\d(?:\.\d+)?)x(?=\s+(?:faster|slower|higher|lower|more|less|larger|smaller|better|fewer|speed-?up|improvement|reduction|increase)\b)/gi,
      "$1×",
    );
}

/**
 * Models often stuff "NFL Draft Tech Day, Pittsburgh, 2026" into the event name.
 * Split it so demos can be listed as "A, B, and C, all in Pittsburgh, 2026".
 */
export function splitEventVenue<T extends { venue: string; location: string; date: string }>(
  e: T,
): T {
  if (e.location || e.date) return e;
  const full = e.venue.match(/^(.*\S),\s*([^,\d][^,]*?),\s*((?:19|20)\d{2})$/);
  if (full) return { ...e, venue: full[1], location: full[2], date: full[3] };
  const yearOnly = e.venue.match(/^(.*\S),\s*((?:19|20)\d{2})$/);
  if (yearOnly) return { ...e, venue: yearOnly[1], date: yearOnly[2] };
  return e;
}

function factFrom(textIn: string, source: string): Fact {
  return { id: newId("f"), text: normalizeFactText(textIn), source };
}

/** Append facts that aren't already there (normalized compare). Returns how many were added. */
function mergeFacts(entry: LibraryEntry, facts: string[], source: string): number {
  const seen = new Set(entry.facts.map((f) => normKey(f.text)));
  let added = 0;
  for (const t of facts.map(normalizeFactText)) {
    const k = normKey(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    entry.facts.push(factFrom(t, source));
    added++;
  }
  return added;
}

function mergeSkills(into: SkillGroup[], groups: SkillGroup[]): SkillGroup[] {
  const out = into.map((g) => ({ ...g, keywords: [...g.keywords] }));
  for (const g of groups) {
    if (!g.name.trim() && !g.keywords.length) continue;
    const hit = out.find((x) => normKey(x.name) === normKey(g.name));
    if (!hit) {
      out.push({ ...g, keywords: [...g.keywords] });
      continue;
    }
    const have = new Set(hit.keywords.map(normKey));
    for (const k of g.keywords) if (!have.has(normKey(k))) hit.keywords.push(k);
  }
  // The first line can't "share the previous line".
  if (out[0]) out[0].sameLine = false;
  return out;
}

export interface ApplyProposalOptions {
  /** Indexes into proposal.ops the user accepted. */
  accept: number[];
  /** sha256 of the source file, recorded as provenance. */
  fileHash?: string;
  fileMime?: string;
  /** Per-op answers the user typed (e.g. what a photo shows / their role). */
  notes?: Record<number, string>;
  now?: string;
}

export interface ApplyResult {
  library: Library;
  /** Human-readable log of what changed, for the UI. */
  log: string[];
}

/**
 * Apply the accepted ops of an ingestion proposal. Never mutates the input.
 * "add" of an entry that already exists (same kind + title + parent) merges
 * into it instead of duplicating — the same project shows up in many files.
 */
export function applyProposal(
  lib0: Library,
  proposal: Proposal,
  opts: ApplyProposalOptions,
): ApplyResult {
  const lib: Library = LibrarySchema.parse(JSON.parse(JSON.stringify(lib0)));
  const now = opts.now ?? new Date().toISOString();
  const source = opts.fileHash ?? "";
  const accepted = new Set(opts.accept);
  const log: string[] = [];
  // tempId ("new-1") -> real id, so children in the same proposal can attach.
  const idMap = new Map<string, string>();

  const resolve = (id: string) => idMap.get(id) ?? id;

  // Adds first (in order), so later ops can reference their temp ids.
  proposal.ops.forEach((op, i) => {
    if (!accepted.has(i) || op.op !== "add" || !op.entry) return;
    const p: ProposedEntry =
      op.entry.kind === "demo" || op.entry.kind === "talk" ? splitEventVenue(op.entry) : op.entry;
    const parentId = p.parentId ? resolve(p.parentId) : "";
    const facts = [...p.facts, ...(opts.notes?.[i] ? [opts.notes[i]] : [])];
    const existing = lib.entries.find(
      (e) =>
        e.kind === p.kind &&
        normKey(e.title) === normKey(p.title) &&
        normKey(e.title) !== "" &&
        (e.parentId === parentId || !parentId || !e.parentId),
    );
    if (existing) {
      if (p.tempId) idMap.set(p.tempId, existing.id);
      const n = mergeFacts(existing, facts, source);
      for (const k of [
        "org",
        "subtitle",
        "location",
        "start",
        "end",
        "date",
        "venue",
        "role",
        "gpa",
        "url",
        "urlLabel",
      ] as const) {
        if (!existing[k] && p[k]) existing[k] = p[k];
      }
      if (source && !existing.sources.includes(source)) existing.sources.push(source);
      existing.updatedAt = now;
      log.push(`Merged into existing "${existing.title || existing.venue}" (+${n} facts).`);
      return;
    }
    const { tempId, facts: _ignored, ...rest } = p;
    void _ignored;
    const entry: LibraryEntry = {
      ...rest,
      id: newId(p.kind.slice(0, 3)),
      parentId,
      facts: [],
      media: [],
      tags: p.tags ?? [],
      sources: source ? [source] : [],
      hidden: false,
      updatedAt: now,
    };
    mergeFacts(entry, facts, source);
    if (tempId) idMap.set(tempId, entry.id);
    lib.entries.push(entry);
    log.push(`Added ${entry.kind} "${entry.title || entry.venue}" (${entry.facts.length} facts).`);
  });

  // Fix up parents that pointed at temp ids of adds processed after them, and
  // drop dangling parents (the user rejected the parent's add).
  for (const e of lib.entries) {
    if (!e.parentId) continue;
    e.parentId = resolve(e.parentId);
    if (!lib.entries.some((x) => x.id === e.parentId)) e.parentId = "";
  }

  proposal.ops.forEach((op, i) => {
    if (!accepted.has(i) || op.op === "add") return;
    const note = opts.notes?.[i]?.trim() ?? "";
    if (op.op === "skills") {
      lib.skills = mergeSkills(lib.skills, op.skills);
      log.push(`Merged ${op.skills.length} skill group(s).`);
      return;
    }
    if (op.op === "basics") {
      if (!op.basics) return;
      const b = lib.basics;
      if (!b.name && op.basics.name) b.name = op.basics.name;
      if (!b.headline && op.basics.headline) b.headline = op.basics.headline;
      const have = new Set(b.contacts.map((c) => normKey(c.text)));
      for (const c of op.basics.contacts) {
        if (c.text && !have.has(normKey(c.text))) b.contacts.push(c);
      }
      log.push("Updated name / contacts (only empty fields).");
      return;
    }
    const target = findEntry(lib, resolve(op.entryId));
    if (!target) {
      log.push(`Skipped an op: entry ${op.entryId} not found.`);
      return;
    }
    if (op.op === "addFacts") {
      const n = mergeFacts(target, [...op.facts, ...(note ? [note] : [])], source);
      if (source && !target.sources.includes(source)) target.sources.push(source);
      target.updatedAt = now;
      log.push(`+${n} facts on "${target.title}".`);
      return;
    }
    if (op.op === "attachMedia") {
      if (!source) return;
      if (!target.media.some((m) => m.file === source)) {
        target.media.push({ file: source, caption: note || op.caption, mime: opts.fileMime ?? "" });
      }
      // What the user says a photo shows is a fact about the project.
      if (note) mergeFacts(target, [note], source);
      target.updatedAt = now;
      log.push(`Attached photo to "${target.title}".`);
    }
  });

  lib.updatedAt = now;
  return { library: lib, log };
}

/** Delete an entry and detach (not delete) its children. */
export function removeEntry(lib: Library, id: string): Library {
  return {
    ...lib,
    entries: lib.entries
      .filter((e) => e.id !== id)
      .map((e) => (e.parentId === id ? { ...e, parentId: "" } : e)),
  };
}

const dateRange = (e: LibraryEntry) => ({
  startDate: e.start || e.date || null,
  endDate: e.end || null,
});

/**
 * Project the library onto the existing Profile shape, so match scoring,
 * letters and interview prep work from the library without changes.
 */
export function libraryToProfile(lib: Library): Profile {
  const visible = lib.entries.filter((e) => !e.hidden);
  const email = lib.basics.contacts.find((c) => /@/.test(c.text))?.text ?? null;
  const site =
    lib.basics.contacts.find((c) => c.url && !/linkedin|github/i.test(c.url))?.url ?? null;
  const profiles = lib.basics.contacts
    .filter((c) => /linkedin|github/i.test(c.url || c.text))
    .map((c) => ({
      network: /linkedin/i.test(c.url || c.text) ? "LinkedIn" : "GitHub",
      url: c.url || c.text,
      username: null,
    }));
  const locationText = lib.basics.contacts.find((c) => !c.url && !/@/.test(c.text))?.text ?? "";
  const [city, region] = locationText.split(",").map((s) => s.trim());

  const extrasFor = (id: string) =>
    visible
      .filter((x) => x.parentId === id && (x.kind === "demo" || x.kind === "talk"))
      .map(
        (x) =>
          `${x.kind === "demo" ? "Live demo" : "Presented"} at ${x.venue || x.title}${x.date ? `, ${x.date}` : ""}`,
      );

  return {
    basics: {
      name: lib.basics.name,
      label: lib.basics.headline || null,
      email,
      url: site,
      location: city ? { city, region: region ?? null } : undefined,
      profiles,
    },
    work: visible
      .filter((e) => e.kind === "position")
      .map((e) => ({
        name: e.org,
        position: e.title,
        location: e.location || null,
        summary: e.subtitle || null,
        ...dateRange(e),
        highlights: e.facts.map((f) => f.text),
      })),
    education: visible
      .filter((e) => e.kind === "education")
      .map((e) => ({
        institution: e.org,
        area: e.title,
        studyType: e.subtitle || null,
        score: e.gpa || null,
        ...dateRange(e),
        courses: [],
      })),
    skills: lib.skills.map((g) => ({ name: g.name, keywords: g.keywords })),
    projects: visible
      .filter((e) => e.kind === "project")
      .map((e) => ({
        name: e.title,
        description: [e.subtitle, e.org].filter(Boolean).join(" · ") || null,
        url: e.url || null,
        ...dateRange(e),
        highlights: [...e.facts.map((f) => f.text), ...extrasFor(e.id)],
        keywords: e.tags,
      })),
    certificates: [],
    publications: visible
      .filter((e) => e.kind === "publication" && e.title)
      .map((e) => ({
        name: e.title,
        publisher: e.venue || null,
        releaseDate: e.date || null,
        url: e.url || null,
        summary: e.role || null,
      })),
    awards: visible
      .filter((e) => e.kind === "award")
      .map((e) => ({
        title: e.title,
        date: e.date || null,
        awarder: e.org || null,
        summary: e.facts[0]?.text ?? null,
      })),
    languages: [],
  };
}
