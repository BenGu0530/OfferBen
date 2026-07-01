import type { Profile } from "./types";

/**
 * Render a curated profile into a clean, single-column, ATS-friendly LaTeX
 * résumé. Deterministic (no AI), so there are no compile errors from
 * hallucinated LaTeX — the model only ever produced the structured content;
 * the formatting is a fixed template. Good for the academic crowd (Overleaf).
 */

function esc(s: string | undefined): string {
  return (s || "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function dates(a?: string, b?: string): string {
  const s = [a, b].filter(Boolean).join(" -- ");
  return s ? esc(s) : "";
}

function flatSkills(p: Profile): string[] {
  return p.skills.flatMap((s) => (s.keywords.length ? s.keywords : s.name ? [s.name] : []));
}

export function profileToLatex(p: Profile, opts: { pageTarget?: 1 | 2 } = {}): string {
  // For a one-pager, shrink font / margins / spacing so a well-curated profile
  // reliably fits — the content is already capped in `tailorResume`, this just
  // buys headroom for bullet wrapping so it doesn't spill to a second page.
  const compact = opts.pageTarget === 1;
  const cls = compact ? "10pt" : "11pt";
  const margin = compact ? "0.45in" : "0.6in";
  const listSpec = compact
    ? "leftmargin=1.1em,topsep=0pt,itemsep=0pt,parsep=0pt"
    : "leftmargin=1.2em,topsep=1pt,itemsep=0pt,parsep=0pt";
  const secSpace = compact ? "{0pt}{5pt}{2pt}" : "{0pt}{7pt}{3pt}";

  const b = p.basics;
  const contact = [
    b.email,
    b.phone,
    b.url,
    ...(b.profiles || []).map((x) => x.url || x.username).filter(Boolean),
    b.location?.city,
  ]
    .filter(Boolean)
    .map((x) => esc(String(x)))
    .join(" \\quad ");

  const L: string[] = [];
  L.push(
    `\\documentclass[${cls},letterpaper]{article}`,
    `\\usepackage[margin=${margin}]{geometry}`,
    "\\usepackage{enumitem,titlesec,hyperref}",
    "\\hypersetup{hidelinks}",
    `\\setlist[itemize]{${listSpec}}`,
    "\\setlength{\\parskip}{0pt}",
    "\\titleformat{\\section}{\\large\\bfseries}{}{0pt}{}[\\titlerule]",
    `\\titlespacing{\\section}${secSpace}`,
    "\\pagestyle{empty}",
    "\\begin{document}",
    "\\begin{center}",
    `{\\LARGE \\bfseries ${esc(b.name) || "Your Name"}}\\\\[2pt]`,
    b.label ? `${esc(b.label)}\\\\[2pt]` : "",
    contact ? `{\\small ${contact}}` : "",
    "\\end{center}",
  );

  if (b.summary) {
    L.push("\\section*{Summary}", esc(b.summary));
  }

  if (p.work.length) {
    L.push("\\section*{Experience}");
    for (const w of p.work) {
      const head = [esc(w.position), esc(w.name)].filter(Boolean).join(" --- ");
      L.push(`\\noindent\\textbf{${head}} \\hfill ${dates(w.startDate, w.endDate)}\\\\`);
      if (w.summary) L.push(`${esc(w.summary)}`);
      if (w.highlights.length) {
        L.push("\\begin{itemize}", ...w.highlights.map((h) => `\\item ${esc(h)}`), "\\end{itemize}");
      }
    }
  }

  if (p.projects.length) {
    L.push("\\section*{Projects}");
    for (const pr of p.projects) {
      L.push(`\\noindent\\textbf{${esc(pr.name)}}\\\\`);
      if (pr.description) L.push(esc(pr.description));
      if (pr.highlights.length) {
        L.push("\\begin{itemize}", ...pr.highlights.map((h) => `\\item ${esc(h)}`), "\\end{itemize}");
      }
    }
  }

  if (p.education.length) {
    L.push("\\section*{Education}");
    for (const e of p.education) {
      const deg = [esc(e.studyType), esc(e.area)].filter(Boolean).join(", ");
      L.push(
        `\\noindent\\textbf{${esc(e.institution)}}${deg ? ` --- ${deg}` : ""} \\hfill ${dates(e.startDate, e.endDate)}\\\\`,
      );
    }
  }

  const skills = flatSkills(p);
  if (skills.length) {
    L.push("\\section*{Skills}", skills.map(esc).join(", "));
  }

  if (p.publications.length) {
    L.push("\\section*{Publications}");
    L.push(
      "\\begin{itemize}",
      ...p.publications.map((pub) => `\\item ${esc(pub.name)}${pub.publisher ? ` --- ${esc(pub.publisher)}` : ""}`),
      "\\end{itemize}",
    );
  }

  if (p.awards.length) {
    L.push("\\section*{Awards}");
    L.push(
      "\\begin{itemize}",
      ...p.awards.map((a) => `\\item ${esc(a.title)}${a.awarder ? ` --- ${esc(a.awarder)}` : ""}`),
      "\\end{itemize}",
    );
  }

  L.push("\\end{document}");
  return L.filter((line) => line !== "").join("\n");
}
