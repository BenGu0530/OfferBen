"use client";

import { useEffect, useMemo, useState } from "react";
import { libraryApi, type BuiltResumePayload } from "@/lib/client";
import {
  SECTION_KEYS,
  SECTION_LABELS,
  type Archetype,
  type Job,
  type SectionKey,
} from "@/lib/types";
import { Chip, ErrorBanner, SectionTitle, Spinner } from "./ui";

const ARCHETYPE_LABEL: Record<Archetype, string> = {
  research: "Research role",
  industry: "Industry engineering",
  entertainment: "Entertainment / themed (demos matter)",
  general: "General",
};

function b64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const slug = (s: string) =>
  s
    .replace(/[^\w]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);

/**
 * LaTeX resume built from the library: curated for a job (1 AI call) or the
 * no-AI base version. Section toggles and page target re-render for free.
 */
export function LibraryResume({ job }: { job: Job | null }) {
  const [res, setRes] = useState<BuiltResumePayload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageTarget, setPageTarget] = useState<1 | 2>(1);

  const pdfUrl = useMemo(
    () =>
      res?.pdfBase64 ? URL.createObjectURL(b64ToBlob(res.pdfBase64, "application/pdf")) : null,
    [res],
  );
  useEffect(() => () => void (pdfUrl && URL.revokeObjectURL(pdfUrl)), [pdfUrl]);

  const canPlan = Boolean(job && job.description.trim().length > 30);
  const active = new Set<SectionKey>(res?.doc.sections.map((s) => s.key) ?? []);

  async function run(
    mode: "plan" | "default" | "render",
    sections?: SectionKey[],
    target = pageTarget,
  ) {
    setBusy(mode);
    setError(null);
    try {
      const out = await libraryApi.resume({
        mode,
        job: mode !== "default" && job ? job : undefined,
        doc: mode === "render" ? res?.doc : undefined,
        sections,
        pageTarget: target,
      });
      setRes(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build the resume.");
    } finally {
      setBusy(null);
    }
  }

  function toggle(key: SectionKey) {
    if (!res) return;
    const next = SECTION_KEYS.filter((k) => (k === key ? !active.has(k) : active.has(k)));
    void run("render", [...next]);
  }

  const base = job?.company ? `Resume_${slug(job.company)}` : "Resume";

  return (
    <div className="card space-y-4 p-5">
      <SectionTitle
        hint={job ? "Built from your library · LaTeX" : "No AI · straight from your library"}
      >
        {job ? "LaTeX resume for this job" : "Base resume preview"}
      </SectionTitle>

      <div className="flex flex-wrap items-center gap-2">
        {job ? (
          <button
            type="button"
            className="btn-primary"
            disabled={!canPlan || Boolean(busy)}
            onClick={() => run("plan")}
            title="One AI call: picks sections, entries and rewrites bullets from your facts"
          >
            {busy === "plan" ? <Spinner /> : null} Tailor from library (1 AI call)
          </button>
        ) : null}
        <button
          type="button"
          className="btn-ghost"
          disabled={Boolean(busy)}
          onClick={() => run("default")}
        >
          {busy === "default" ? <Spinner /> : null} Base resume (no AI)
        </button>
        <div className="ml-auto flex items-center gap-1 text-xs text-slate-400">
          Pages
          {[1, 2].map((n) => (
            <button
              key={n}
              type="button"
              className={
                pageTarget === n
                  ? "btn-primary px-2.5 py-1 text-xs"
                  : "btn-ghost px-2.5 py-1 text-xs"
              }
              disabled={Boolean(busy)}
              onClick={() => {
                setPageTarget(n as 1 | 2);
                if (res) void run("render", [...active], n as 1 | 2);
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <ErrorBanner message={error} />

      {res ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Chip tone="brand">{ARCHETYPE_LABEL[res.doc.archetype]}</Chip>
            {res.pages != null ? (
              <Chip tone={res.pages <= pageTarget ? "good" : "bad"}>
                {res.pages} page{res.pages > 1 ? "s" : ""}
              </Chip>
            ) : null}
            {busy === "render" ? <Spinner className="text-slate-400" /> : null}
          </div>

          <div>
            <span className="label">Sections (click to toggle · free)</span>
            <div className="flex flex-wrap gap-1.5">
              {SECTION_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => toggle(k)}
                  className={
                    active.has(k)
                      ? "chip border-brand-400/40 bg-brand-500/20 text-brand-100"
                      : "chip border-white/10 bg-white/5 text-slate-500 line-through"
                  }
                >
                  {SECTION_LABELS[k]}
                </button>
              ))}
            </div>
          </div>

          {res.doc.notes.length || res.notes.length || res.warnings.length ? (
            <ul className="space-y-1 text-xs text-slate-400">
              {res.doc.notes.map((n, i) => (
                <li key={`n${i}`}>• {n}</li>
              ))}
              {res.notes.map((n, i) => (
                <li key={`f${i}`} className="text-sky-300/80">
                  • {n}
                </li>
              ))}
              {res.warnings.map((n, i) => (
                <li key={`w${i}`} className="text-amber-300/80">
                  • {n}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {res.pdfBase64 ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  download(b64ToBlob(res.pdfBase64!, "application/pdf"), `${base}.pdf`)
                }
              >
                Download PDF
              </button>
            ) : null}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => download(new Blob([res.tex], { type: "text/x-tex" }), `${base}.tex`)}
            >
              Download .tex
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void navigator.clipboard.writeText(res.tex).catch(() => undefined)}
            >
              Copy .tex
            </button>
          </div>

          {pdfUrl ? (
            <iframe
              title="Resume preview"
              src={pdfUrl}
              className="h-[860px] w-full rounded-lg border border-white/10 bg-white"
            />
          ) : (
            <pre className="scroll-thin max-h-96 overflow-auto rounded-lg bg-slate-950/60 p-3 text-xs text-slate-300">
              {res.tex}
            </pre>
          )}
        </>
      ) : null}
    </div>
  );
}
