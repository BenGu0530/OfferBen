import type { Library, LibraryEntry } from "../schema/library";
import { normalizeFactText, normKey } from "../library/library";
import {
  autoBold,
  homeSection,
  type ResumeBullet,
  type ResumeDoc,
  type ResumeItem,
  type SectionKey,
} from "./doc";

/**
 * Code-level guards on an AI-curated resume. The prompt asks the model to stay
 * truthful; this makes it so:
 *  - every entry and fact it cites must exist,
 *  - every number in a bullet must appear in the facts it cites
 *    (otherwise the bullet is reverted to the cited facts verbatim),
 *  - at most ONE **bold** span per bullet,
 *  - skills must come from the library.
 */

const BOLD = /\*\*(.+?)\*\*/g;

/** Keep the first **bold** span, unwrap the rest. */
export function limitBold(s: string, max = 1): string {
  let n = 0;
  return s.replace(BOLD, (_m, inner: string) => (++n <= max ? `**${inner}**` : inner));
}

/** Numbers a bullet asserts ("1.8×" -> "1.8", "96%" -> "96", "2,500" -> "2500"). */
export function numbersIn(s: string): string[] {
  return (s.replace(/(\d),(\d{3})/g, "$1$2").match(/\d+(?:\.\d+)?/g) ?? []).map((n) =>
    n.replace(/^0+(?=\d)/, ""),
  );
}

function entryOk(e: LibraryEntry | undefined, key: SectionKey, lib: Library, asChild: boolean) {
  if (!e || e.hidden) return false;
  if (asChild) return e.kind === "project";
  return homeSection(e, lib) === key;
}

export interface ValidateResult {
  doc: ResumeDoc;
  warnings: string[];
}

export function validateResumeDoc(doc: ResumeDoc, lib: Library): ValidateResult {
  const warnings: string[] = [];
  const byId = new Map(lib.entries.map((e) => [e.id, e]));
  const used = new Set<string>();

  const fixBullets = (e: LibraryEntry, bullets: ResumeBullet[]): ResumeBullet[] => {
    const facts = new Map(e.facts.map((f) => [f.id, f.text]));
    const out: ResumeBullet[] = [];
    for (const b of bullets) {
      const ids = b.factIds.filter((id) => facts.has(id));
      if (!ids.length) {
        warnings.push(`Dropped a bullet on "${e.title}" that cited no real fact.`);
        continue;
      }
      const sourceText = ids.map((id) => facts.get(id)!).join(" ");
      const have = new Set(numbersIn(sourceText + " " + e.title));
      const bad = numbersIn(b.text).filter((n) => !have.has(n));
      if (bad.length) {
        warnings.push(
          `Reverted a bullet on "${e.title}": ${bad.join(", ")} not in the source facts.`,
        );
        out.push({ text: ids.map((id) => facts.get(id)!).join("; "), factIds: ids });
        continue;
      }
      // One bold per bullet: keep the model's first; if it marked none, bold the first metric.
      out.push({ text: autoBold(limitBold(normalizeFactText(b.text))), factIds: ids });
    }
    // An item must say something: fall back to its first facts verbatim.
    if (!out.length && e.facts.length) {
      return e.facts.slice(0, 2).map((f) => ({ text: f.text, factIds: [f.id] }));
    }
    return out;
  };

  const sections = doc.sections
    .map((s) => {
      const items: ResumeItem[] = [];
      // The skills section renders doc.skills; any "items" the model put there are noise.
      if (s.key === "skills") return { key: s.key, items };
      for (const it of s.items) {
        const e = byId.get(it.entryId);
        if (!entryOk(e, s.key, lib, false) || used.has(it.entryId)) {
          warnings.push(`Removed unknown/misplaced entry ${it.entryId} from ${s.key}.`);
          continue;
        }
        used.add(e!.id);
        const children = it.children.flatMap((c) => {
          const ce = byId.get(c.entryId);
          if (!entryOk(ce, s.key, lib, true) || ce!.parentId !== e!.id || used.has(c.entryId)) {
            warnings.push(`Removed misplaced child ${c.entryId}.`);
            return [];
          }
          used.add(ce!.id);
          return [{ entryId: ce!.id, bullets: fixBullets(ce!, c.bullets) }];
        });
        const listy =
          s.key === "publications" ||
          s.key === "demos" ||
          s.key === "talks" ||
          s.key === "awards" ||
          s.key === "education";
        items.push({
          entryId: e!.id,
          // Section-header positions with children carry no bullets of their own in this layout.
          bullets:
            listy || (children.length && !it.bullets.length) ? [] : fixBullets(e!, it.bullets),
          children,
        });
      }
      return { key: s.key, items };
    })
    .filter((s) => s.key === "skills" || s.items.length > 0);

  // Skills: only keywords the library actually has (case-insensitive), library spelling.
  const known = new Map<string, string>();
  for (const g of lib.skills) for (const k of g.keywords) known.set(normKey(k), k);
  const skills = doc.skills
    .map((g) => {
      const kws = g.keywords
        .map((k) => known.get(normKey(k)))
        .filter((k): k is string => Boolean(k));
      const dropped = g.keywords.length - kws.length;
      if (dropped)
        warnings.push(`Dropped ${dropped} skill(s) from "${g.name}" not in your library.`);
      return { ...g, keywords: [...new Set(kws)] };
    })
    .filter((g) => g.keywords.length);

  return { doc: { ...doc, sections, skills }, warnings };
}

/**
 * One deterministic trimming step for page fitting (called after density
 * tweaks run out). Returns null when there's nothing sensible left to cut.
 * Order: shave the longest bullet list first, then drop trailing low-priority
 * items. Never touches education or skills.
 */
export function trimStep(doc: ResumeDoc): { doc: ResumeDoc; note: string } | null {
  const d: ResumeDoc = JSON.parse(JSON.stringify(doc));
  // 1) Longest bullet list (>2 bullets) — scan from the end of the page.
  let best: { len: number; bullets: ResumeBullet[] } | null = null;
  for (const s of [...d.sections].reverse()) {
    for (const it of [...s.items].reverse()) {
      for (const holder of [...[...it.children].reverse(), it]) {
        if (holder.bullets.length > 2 && (!best || holder.bullets.length > best.len)) {
          best = { len: holder.bullets.length, bullets: holder.bullets };
        }
      }
    }
  }
  if (best) {
    best.bullets.pop();
    return { doc: d, note: "Cut the last bullet of the longest item to fit the page." };
  }
  // 2) Drop the last item of a low-priority section that has more than one.
  for (const key of ["awards", "talks", "projects", "demos", "publications"] as SectionKey[]) {
    const s = d.sections.find((x) => x.key === key);
    if (s && s.items.length > 1) {
      s.items.pop();
      return { doc: d, note: `Dropped the last ${key} item to fit the page.` };
    }
  }
  // 3) Then bullets down to one per item.
  for (const s of [...d.sections].reverse()) {
    for (const it of [...s.items].reverse()) {
      for (const holder of [...[...it.children].reverse(), it]) {
        if (holder.bullets.length > 1) {
          holder.bullets.pop();
          return { doc: d, note: "Cut a bullet to fit the page." };
        }
      }
    }
  }
  return null;
}

/** Skill keywords, with parenthesized lists expanded: "Reinforcement Learning (PPO, SAC)" -> 3 terms. */
function skillTerms(lib: Library): string[] {
  const out = new Set<string>();
  for (const g of lib.skills) {
    for (const k of g.keywords) {
      const m = k.match(/^(.*?)\s*\((.*)\)\s*$/);
      const parts = m ? [m[1], ...m[2].split(/[,/]/)] : [k];
      for (const p of parts.map((x) => x.trim())) if (p.length >= 2) out.add(p);
    }
  }
  for (const e of lib.entries) for (const t of e.tags) if (t.length >= 2) out.add(t);
  return [...out];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-term, case-insensitive, and "reinforcement learning" == "reinforcement-learning". */
const termRe = (t: string) =>
  new RegExp(`(?<![\\w])${esc(t).replace(/(?:\\ |-|\s)+/g, "[\\s-]+")}(?![\\w])`, "i");

/**
 * Second bold fallback (after metrics): for bullets that still have no bold,
 * bold the first of the candidate's skills that THIS job asks for. Keeps the
 * one-highlight-per-bullet rule job-relevant without another AI call.
 */
export function boldJobKeywords(doc: ResumeDoc, lib: Library, jobText: string): ResumeDoc {
  const all = skillTerms(lib);
  // Job-relevant terms first (in the order the job mentions them), then any other skill.
  const jobTerms = all
    .map((t) => ({ t, at: jobText.search(termRe(t)) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at || b.t.length - a.t.length)
    .map((x) => x.t);
  const boldAt = (b: ResumeBullet, m: RegExpMatchArray): ResumeBullet => ({
    ...b,
    text: `${b.text.slice(0, m.index)}**${m[0]}**${b.text.slice(m.index! + m[0].length)}`,
  });
  const fix = (b: ResumeBullet): ResumeBullet => {
    if (b.text.includes("**")) return b;
    for (const t of jobTerms) {
      const m = b.text.match(termRe(t));
      if (m && m.index !== undefined) return boldAt(b, m);
    }
    // No job term in this bullet: the earliest skill it mentions, longest on ties.
    let best: RegExpMatchArray | null = null;
    for (const t of all) {
      const m = b.text.match(termRe(t));
      if (
        m &&
        m.index !== undefined &&
        (!best || m.index < best.index! || (m.index === best.index && m[0].length > best[0].length))
      ) {
        best = m;
      }
    }
    return best ? boldAt(b, best) : b;
  };
  return {
    ...doc,
    sections: doc.sections.map((s) => ({
      ...s,
      items: s.items.map((it) => ({
        ...it,
        bullets: it.bullets.map(fix),
        children: it.children.map((c) => ({ ...c, bullets: c.bullets.map(fix) })),
      })),
    })),
  };
}
