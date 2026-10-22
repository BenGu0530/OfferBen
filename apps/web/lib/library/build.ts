import { DENSITY, renderResumeTex, trimStep, type Library, type ResumeDoc } from "@offerben/core";
import { compileTex, TectonicMissingError } from "./tectonic";

export interface BuiltResume {
  doc: ResumeDoc;
  tex: string;
  pdfBase64: string | null;
  pages: number | null;
  density: number;
  notes: string[];
}

/**
 * Fit to the page target by MEASURING, not guessing: compile, and if it spills,
 * first tighten spacing (the candidate's own knobs, in steps), then cut content
 * deterministically one step at a time. Typically 1-3 compiles.
 */
export async function fitAndCompile(
  lib: Library,
  doc0: ResumeDoc,
  pageTarget: number,
): Promise<BuiltResume> {
  const notes: string[] = [];
  let doc = doc0;
  let last: BuiltResume | null = null;

  const attempt = async (density: number): Promise<boolean> => {
    const tex = renderResumeTex(lib, doc, { density });
    const out = await compileTex(tex);
    last = { doc, tex, pdfBase64: out.pdf.toString("base64"), pages: out.pages, density, notes };
    return out.pages <= pageTarget;
  };

  try {
    for (let d = 0; d < DENSITY.length; d++) {
      if (await attempt(d)) {
        if (d > 0) notes.push(`Tightened spacing (level ${d}) to fit ${pageTarget} page(s).`);
        return last!;
      }
    }
    for (let i = 0; i < 15; i++) {
      const t = trimStep(doc);
      if (!t) break;
      doc = t.doc;
      notes.push(t.note);
      if (await attempt(DENSITY.length - 1)) return last!;
    }
    const pages = (last as BuiltResume | null)?.pages;
    notes.push(
      `Still ${pages} pages — hide something in the library or switch to ${pageTarget + 1} pages.`,
    );
    return last!;
  } catch (err) {
    if (err instanceof TectonicMissingError) {
      return {
        doc,
        tex: renderResumeTex(lib, doc, { density: 0 }),
        pdfBase64: null,
        pages: null,
        density: 0,
        notes: [
          ...notes,
          "No PDF preview: install tectonic (brew install tectonic). The .tex download still works.",
        ],
      };
    }
    throw err;
  }
}
