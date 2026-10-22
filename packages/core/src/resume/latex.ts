import type { Library, LibraryEntry, SkillGroup } from "../schema/library";
import type { ResumeBullet, ResumeChild, ResumeDoc, ResumeItem, ResumeSection } from "./doc";
import { SECTION_TITLES } from "./doc";

/**
 * Library + ResumeDoc -> LaTeX, in the "classic" layout (the candidate's own
 * one-page template: centered name, ruled small-caps-free section heads, dates
 * flush right, lab -> project two-level research block).
 *
 * Deterministic and AI-free. The output compiles on pdfTeX (Overleaf's default)
 * AND XeTeX (local tectonic): Unicode symbols in facts are mapped to LaTeX
 * commands, and on pdfTeX glyphtounicode is enabled so ATS text extraction gets
 * real characters.
 */

export interface DensityPreset {
  geometry: string;
  itemsep: number;
  topsep: number;
  secBefore: number;
  secAfter: number;
}

/** Tightest last. Index 0 is the candidate's own hand-tuned spacing. */
export const DENSITY: DensityPreset[] = [
  { geometry: "margin=0.5in", itemsep: 2.6, topsep: 3, secBefore: 1.4, secAfter: 0.8 },
  { geometry: "margin=0.5in", itemsep: 1.8, topsep: 2, secBefore: 1.2, secAfter: 0.7 },
  {
    geometry: "left=0.45in,right=0.45in,top=0.4in,bottom=0.4in",
    itemsep: 1.2,
    topsep: 2,
    secBefore: 1.1,
    secAfter: 0.6,
  },
  {
    geometry: "left=0.4in,right=0.4in,top=0.35in,bottom=0.35in",
    itemsep: 0.8,
    topsep: 1.5,
    secBefore: 1.0,
    secAfter: 0.5,
  },
];

export interface RenderOptions {
  density?: number;
  paper?: "a4" | "letter";
}

// --- text -> LaTeX -------------------------------------------------------------

const GREEK: Record<string, string> = {
  α: "alpha",
  β: "beta",
  γ: "gamma",
  δ: "delta",
  ε: "epsilon",
  θ: "theta",
  λ: "lambda",
  μ: "mu",
  µ: "mu",
  π: "pi",
  ρ: "rho",
  σ: "sigma",
  τ: "tau",
  φ: "phi",
  ω: "omega",
  Δ: "Delta",
  Θ: "Theta",
  Λ: "Lambda",
  Π: "Pi",
  Σ: "Sigma",
  Φ: "Phi",
  Ω: "Omega",
};

const CHAR_MAP: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
  "<": "\\textless{}",
  ">": "\\textgreater{}",
  "×": "$\\times$",
  "°": "\\textdegree{}",
  "∝": "$\\propto$",
  "≈": "$\\approx$",
  "±": "$\\pm$",
  "≤": "$\\le$",
  "≥": "$\\ge$",
  "→": "$\\rightarrow$",
  "∼": "$\\sim$",
  "–": "--",
  "—": "---",
  "“": "``",
  "”": "''",
  "‘": "`",
  "’": "'",
  "²": "\\textsuperscript{2}",
  "³": "\\textsuperscript{3}",
  "…": "\\ldots{}",
  "\u00a0": "~",
};
for (const [g, name] of Object.entries(GREEK)) CHAR_MAP[g] = `$\\${name}$`;

const SPECIALS = new RegExp(
  `[${Object.keys(CHAR_MAP)
    .map((c) => c.replace(/[\\\]^-]/g, "\\$&"))
    .join("")}]`,
  "g",
);

/** Escape plain text for LaTeX (single pass, so escapes are never re-escaped). */
export function texEscape(s: string): string {
  return s.replace(SPECIALS, (c) => CHAR_MAP[c] ?? c);
}

/** A $...$ span is treated as math only if it looks like math, so "$50k and $20k" stays text. */
const looksLikeMath = (inner: string) => /[\\^_=<>]/.test(inner) || /^\s*[A-Za-z]\s*$/.test(inner);

/** Plain text, except "L^0.5" / "x^{2}" become real superscripts instead of a literal caret. */
function textWithSup(s: string): string {
  const out: string[] = [];
  let last = 0;
  for (const m of s.matchAll(/(?<=\S)\^(?:\{([^}]+)\}|([0-9.]+|[A-Za-z]))/g)) {
    out.push(texEscape(s.slice(last, m.index)));
    out.push(`\\textsuperscript{${texEscape(m[1] ?? m[2])}}`);
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(texEscape(s.slice(last)));
  return out.join("");
}

function mathOrText(seg: string): string {
  const out: string[] = [];
  let last = 0;
  for (const m of seg.matchAll(/\$([^$]+)\$/g)) {
    const inner = m[1];
    if (!looksLikeMath(inner)) continue;
    out.push(textWithSup(seg.slice(last, m.index)));
    // "$6^{\circ}$" extracts as "6\n◦" from PDFs; a text degree sign stays inline.
    const deg = inner.match(/^\s*(\d+(?:\.\d+)?)\s*\^\s*\{?\s*\\circ\s*\}?\s*$/);
    out.push(deg ? `${deg[1]}\\textdegree{}` : `$${inner}$`);
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(textWithSup(seg.slice(last)));
  return out.join("");
}

/** Rich text: **bold** spans, $math$ passthrough, everything else escaped. */
export function richText(s: string): string {
  const out: string[] = [];
  let last = 0;
  for (const m of s.matchAll(/\*\*(.+?)\*\*/g)) {
    out.push(mathOrText(s.slice(last, m.index)));
    out.push(`\\textbf{${mathOrText(m[1])}}`);
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(mathOrText(s.slice(last)));
  return out.join("");
}

const hrefUrl = (u: string) => u.replace(/\\/g, "").replace(/%/g, "\\%").replace(/#/g, "\\#");
const href = (url: string, label: string) => `\\href{${hrefUrl(url)}}{${richText(label)}}`;

/** "A", "A and B", "A, B, and C". */
function listJoin(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`;
}

const dates = (e: LibraryEntry) =>
  e.start || e.end ? [e.start, e.end].filter(Boolean).map(richText).join(" -- ") : richText(e.date);

// --- blocks --------------------------------------------------------------------

function itemize(lines: string[]): string {
  if (!lines.length) return "";
  return ["\\begin{itemize}", ...lines.map((l) => `    \\item ${l}`), "\\end{itemize}"].join("\n");
}

const bulletLines = (bs: ResumeBullet[]) => bs.map((b) => richText(b.text));

/**
 * The bullet that carries a project's publications / demos / talks when those
 * don't have their own section — e.g.
 * "Publication (Co-First Author): “Title,” arXiv:…, under review at ICRA 2027;
 *  live hardware demos at A, B, and C, all in Pittsburgh, 2026."
 */
export function inlineExtras(lib: Library, doc: ResumeDoc, entryId: string): string | null {
  const has = (k: string) => doc.sections.some((s) => s.key === k);
  const kids = lib.entries.filter((e) => e.parentId === entryId && !e.hidden);
  const pubs = has("publications") ? [] : kids.filter((e) => e.kind === "publication");
  const demos = has("demos") ? [] : kids.filter((e) => e.kind === "demo");
  const talks = has("talks") ? [] : kids.filter((e) => e.kind === "talk");
  if (!pubs.length && !demos.length && !talks.length) return null;

  const parts: string[] = [];
  const titled = pubs.filter((p) => p.title);
  const untitled = pubs.filter((p) => !p.title);
  for (const p of titled) {
    const bits = [`\`\`${richText(p.title)},''`];
    if (p.url) bits.push(`${href(p.url, p.urlLabel || p.url)},`);
    if (p.venue) bits.push(richText(p.venue));
    parts.push(bits.join(" ").replace(/,$/, ""));
  }
  if (untitled.length) {
    const venues = untitled.map((p) => p.venue || p.date).filter(Boolean);
    const allWorkshop = venues.every((v) => /workshop/i.test(v));
    parts.push(
      allWorkshop
        ? `workshop papers at ${listJoin(venues.map((v) => richText(v.replace(/\s*workshop( paper)?s?/i, ""))))}`
        : listJoin(venues.map(richText)),
    );
  }
  const where = (xs: LibraryEntry[]) => {
    const locs = new Set(xs.map((x) => x.location));
    const ds = new Set(xs.map((x) => x.date));
    // Skip the year when every event name already carries it ("NCUR 2025").
    const date = xs.every((x) => x.date && (x.venue || x.title).includes(x.date)) ? "" : xs[0].date;
    if (xs.length > 1 && locs.size === 1 && ds.size === 1 && (xs[0].location || date)) {
      return `, all in ${richText([xs[0].location, date].filter(Boolean).join(", "))}`;
    }
    return "";
  };
  const names = (xs: LibraryEntry[]) => listJoin(xs.map((x) => richText(x.venue || x.title)));
  if (demos.length)
    parts.push(`${pubs.length ? "live hardware demos at " : ""}${names(demos)}${where(demos)}`);
  if (talks.length)
    parts.push(
      `${pubs.length || demos.length ? "presented at " : ""}${names(talks)}${where(talks)}`,
    );

  const role = titled.find((p) => p.role)?.role;
  const label = pubs.length
    ? `${pubs.length > 1 ? "Publications" : "Publication"}${role ? ` (${richText(role)})` : ""}:`
    : demos.length
      ? "Public demos:"
      : "Presented at:";
  return `\\textbf{${label}} ${parts.join("; ")}.`;
}

function header(lib: Library): string {
  const contacts = lib.basics.contacts
    .filter((c) => c.text)
    .map((c) => {
      if (c.url) return href(c.url, c.text);
      if (/^[^\s@]+@[^\s@]+$/.test(c.text)) return href(`mailto:${c.text}`, c.text);
      return richText(c.text);
    });
  return [
    "\\begin{center}",
    `    {\\huge \\textbf{${richText(lib.basics.name || "Your Name")}}} \\\\[2pt]`,
    `    ${contacts.join(" $|$\n    ")}`,
    "\\end{center}",
  ].join("\n");
}

function educationBlock(lib: Library, items: ResumeItem[]): string {
  const entries = items
    .map((it) => lib.entries.find((e) => e.id === it.entryId))
    .filter((e): e is LibraryEntry => Boolean(e));
  const groups: LibraryEntry[][] = [];
  for (const e of entries) {
    const g = groups[groups.length - 1];
    if (g && g[0].org === e.org) g.push(e);
    else groups.push([e]);
  }
  return groups
    .map((g) => {
      const head = `\\textbf{${richText(g[0].org)}}${g[0].location ? `, ${richText(g[0].location)}` : ""}`;
      const lines = g.map((e) => {
        const left = `\\textbf{${richText(e.title)}}${e.subtitle ? `, ${richText(e.subtitle)}` : ""}`;
        const gpa = e.gpa ? ` \\textit{GPA: ${richText(e.gpa)}}` : "";
        return `\\makebox[\\degreewidth][l]{${left}}${gpa} \\hfill ${dates(e)}`;
      });
      return ["\\noindent", [head, ...lines].join(" \\\\\n")].join("\n");
    })
    .join("\n\\vspace{2pt}\n\n");
}

function childBlock(lib: Library, doc: ResumeDoc, c: ResumeChild): string {
  const e = lib.entries.find((x) => x.id === c.entryId);
  if (!e) return "";
  const head = `\\textbf{${richText(e.title)}} \\hfill ${dates(e)}`;
  const sub = e.subtitle ? `\\\\\n\\textit{${richText(e.subtitle)}}` : "";
  const extra = inlineExtras(lib, doc, e.id);
  return ["\\noindent", head + sub, itemize([...bulletLines(c.bullets), ...(extra ? [extra] : [])])]
    .filter(Boolean)
    .join("\n");
}

function positionBlock(lib: Library, doc: ResumeDoc, it: ResumeItem): string {
  const e = lib.entries.find((x) => x.id === it.entryId);
  if (!e) return "";
  if (it.children.length) {
    // Lab / company header with projects underneath (two-level layout).
    const where = [e.org, e.subtitle ? `(${e.subtitle})` : ""].filter(Boolean).join(" ");
    const head = `\\textbf{${richText(e.title)}}${where ? `, \\textit{${richText(where)}}` : ""} \\hfill ${dates(e)}`;
    return [
      ["\\noindent", head, itemize(bulletLines(it.bullets)), "\\vspace{2pt}"]
        .filter(Boolean)
        .join("\n"),
      ...it.children.map((c) => childBlock(lib, doc, c)),
    ].join("\n\n");
  }
  const line2 =
    [e.org, e.location].filter(Boolean).join(", ") + (e.subtitle ? ` (${e.subtitle})` : "");
  const extra = inlineExtras(lib, doc, e.id);
  return [
    "\\noindent",
    `\\textbf{${richText(e.title)}} \\hfill ${dates(e)}${line2 ? `\\\\\n\\textit{${richText(line2)}}` : ""}`,
    itemize([...bulletLines(it.bullets), ...(extra ? [extra] : [])]),
  ]
    .filter(Boolean)
    .join("\n");
}

function listSection(lib: Library, key: ResumeSection["key"], items: ResumeItem[]): string {
  const grouped = new Set<string>();
  const lines = items.flatMap((it) => {
    const e = lib.entries.find((x) => x.id === it.entryId);
    if (!e || grouped.has(e.id)) return [];
    if ((key === "demos" || key === "talks") && !e.facts.length && e.parentId) {
      // Several fact-less events of one project -> ONE line, not N copies of its long title.
      const siblings = items
        .map((x) => lib.entries.find((y) => y.id === x.entryId))
        .filter((y): y is LibraryEntry =>
          Boolean(y && y.parentId === e.parentId && !y.facts.length),
        );
      const parent = lib.entries.find((x) => x.id === e.parentId);
      if (siblings.length > 1 && parent) {
        siblings.forEach((s) => grouped.add(s.id));
        const names = listJoin(siblings.map((s) => richText(s.venue || s.title)));
        const locs = new Set(siblings.map((s) => s.location));
        const ds = new Set(siblings.map((s) => s.date));
        const yearInNames = siblings.every((s) => (s.venue || s.title).includes(s.date));
        const tail =
          locs.size === 1 && ds.size === 1
            ? [siblings[0].location, yearInNames ? "" : siblings[0].date]
                .filter(Boolean)
                .map(richText)
                .join(", ")
            : "";
        const what = key === "demos" ? "live hardware demos of the" : "presented the";
        return [`\\textbf{${names}}${tail ? `, ${tail}` : ""}: ${what} ${richText(parent.title)}.`];
      }
    }
    const parent = e.parentId ? lib.entries.find((x) => x.id === e.parentId) : undefined;
    if (key === "publications" && !e.title && e.parentId) {
      // Untitled workshop papers of one project -> one line that says which work they cover.
      const siblings = items
        .map((x) => lib.entries.find((y) => y.id === x.entryId))
        .filter((y): y is LibraryEntry => Boolean(y && !y.title && y.parentId === e.parentId));
      siblings.forEach((s) => grouped.add(s.id));
      const venues = siblings.map((s) => s.venue || s.date).filter(Boolean);
      const allWorkshop = venues.every((v) => /workshop/i.test(v));
      const where = listJoin(
        venues.map((v) => richText(allWorkshop ? v.replace(/\s*workshop( paper)?s?/i, "") : v)),
      );
      const label = allWorkshop
        ? `Workshop paper${siblings.length > 1 ? "s" : ""} at`
        : "Also presented at";
      return [`${label} ${where}${parent ? `, on the ${richText(parent.title)}` : ""}.`];
    }
    if (key === "publications") {
      const bits = [
        e.title ? `\`\`${richText(e.title)},''` : "",
        e.venue ? `\\textit{${richText(e.venue)}}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const link = e.url ? `, ${href(e.url, e.urlLabel || e.url)}` : "";
      const role = e.role ? ` (${richText(e.role)})` : "";
      return [`${bits}${link}${e.date ? `, ${richText(e.date)}` : ""}.${role}`];
    }
    if (key === "demos" || key === "talks") {
      const name = e.venue || e.title;
      const where = [name, e.location, name.includes(e.date) ? "" : e.date]
        .filter(Boolean)
        .map(richText);
      const what =
        e.facts[0]?.text ??
        (parent
          ? `${key === "demos" ? "Live hardware demo of the" : "Presented the"} ${parent.title}`
          : "");
      return [
        `\\textbf{${where.shift() ?? ""}}${where.length ? `, ${where.join(", ")}` : ""}${what ? `: ${richText(what)}` : ""}`,
      ];
    }
    // awards
    return [
      `\\textbf{${richText(e.title)}}${e.org ? `, ${richText(e.org)}` : ""}${e.date ? ` \\hfill ${richText(e.date)}` : ""}`,
    ];
  });
  return itemize(lines);
}

function skillsBlock(groups: SkillGroup[]): string {
  const lines: string[] = [];
  for (const g of groups) {
    const piece = `\\textbf{${richText(g.name)}:} ${g.keywords.map(richText).join(", ")}`;
    if (g.sameLine && lines.length) lines[lines.length - 1] += ` \\quad ${piece}`;
    else lines.push(piece);
  }
  return itemize(lines);
}

function sectionBody(lib: Library, doc: ResumeDoc, s: ResumeSection): string {
  switch (s.key) {
    case "education":
      return educationBlock(lib, s.items);
    case "experience":
    case "research":
      return s.items.map((it) => positionBlock(lib, doc, it)).join("\n\n");
    case "projects":
      return s.items.map((it) => childBlock(lib, doc, it)).join("\n\n");
    case "skills":
      return skillsBlock(doc.skills.length ? doc.skills : lib.skills);
    default:
      return listSection(lib, s.key, s.items);
  }
}

export function renderResumeTex(lib: Library, doc: ResumeDoc, opts: RenderOptions = {}): string {
  const d = DENSITY[Math.max(0, Math.min(DENSITY.length - 1, opts.density ?? 0))];
  const paper = opts.paper === "letter" ? "letterpaper" : "a4paper";
  const name = (lib.basics.name || "Resume").replace(/[{}\\]/g, "");
  const preamble = [
    `\\documentclass[${paper},10pt]{article}`,
    "\\usepackage{iftex}",
    "\\ifPDFTeX",
    "  \\usepackage[T1]{fontenc}",
    "  \\usepackage{lmodern}",
    "  \\usepackage{textcomp}",
    "  \\input{glyphtounicode}",
    "  \\pdfgentounicode=1",
    "\\else",
    "  \\usepackage{fontspec}",
    "\\fi",
    "\\usepackage{amsmath}",
    "\\usepackage{titlesec}",
    "\\usepackage{enumitem}",
    "\\usepackage{geometry}",
    "\\usepackage{hyperref}",
    "",
    `\\geometry{${d.geometry}}`,
    "\\pagestyle{empty}",
    "\\setlength{\\emergencystretch}{3em}",
    "% No hyphenation: every keyword stays whole when an ATS extracts the text.",
    "\\hyphenpenalty=10000",
    "\\exhyphenpenalty=10000",
    `\\setlist[itemize]{leftmargin=*, itemsep=${d.itemsep}pt, parsep=0pt, topsep=${d.topsep}pt}`,
    "\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\titlerule]",
    `\\titlespacing{\\section}{0pt}{${d.secBefore}ex}{${d.secAfter}ex}`,
    "\\newcommand{\\degreewidth}{4in}",
    `\\hypersetup{colorlinks=true, urlcolor=blue, linkcolor=black, pdftitle={${name} Resume}, pdfauthor={${name}}}`,
  ].join("\n");

  const body = doc.sections
    .map((s) => {
      const content = sectionBody(lib, doc, s);
      return content ? `\\section*{${SECTION_TITLES[s.key]}}\n${content}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  return `${preamble}\n\n\\begin{document}\n\n${header(lib)}\n\n${body}\n\n\\end{document}\n`;
}
