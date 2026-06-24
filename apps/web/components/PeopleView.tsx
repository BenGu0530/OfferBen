"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import type { AuthorCandidate, AuthorDossier, ResearchTaste } from "@/lib/types";
import { Chip, CopyButton, ErrorBanner, SectionTitle, Spinner } from "./ui";

export function PeopleView() {
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [candidates, setCandidates] = useState<AuthorCandidate[] | null>(null);
  const [dossier, setDossier] = useState<AuthorDossier | null>(null);
  const [taste, setTaste] = useState<ResearchTaste | null>(null);
  const [tasteNote, setTasteNote] = useState<string | null>(null);
  const [loading, setLoading] = useState<"search" | "dossier" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!name.trim()) return;
    setError(null);
    setDossier(null);
    setTaste(null);
    setLoading("search");
    try {
      const { candidates: c } = await api.searchPeople({ name, institution });
      setCandidates(c);
      if (!c.length) setError("No researchers found. Try adding or changing the institution.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(null);
    }
  }

  async function pick(c: AuthorCandidate) {
    setError(null);
    setDossier(null);
    setTaste(null);
    setTasteNote(null);
    setLoading("dossier");
    try {
      const { dossier: d, taste: t, tasteError } = await api.dossier({ authorId: c.id });
      setDossier(d);
      setTaste(t);
      if (!t) setTasteNote(tasteError ?? "Research-taste summary needs an available AI model.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <SectionTitle hint="Compliant — official scholarly data only">
          Research a person
        </SectionTitle>
        <p className="mb-4 text-sm text-slate-400">
          Find a hiring manager, referrer, professor, or tech lead&apos;s schools,
          labs, publications, and inferred research taste — to write a sharper
          referral note or prep for an interview. Sourced from OpenAlex; no scraping.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="input"
            placeholder="Name (e.g. Aaron Johnson)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <input
            className="input"
            placeholder="Institution / company (optional, disambiguates)"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button type="button" className="btn-primary" disabled={loading === "search"} onClick={search}>
            {loading === "search" ? <Spinner /> : null} Search
          </button>
        </div>
        {error ? <div className="mt-3"><ErrorBanner message={error} /></div> : null}
      </div>

      {candidates && candidates.length > 0 && !dossier ? (
        <div className="card p-5">
          <div className="label mb-2">Pick the right person</div>
          <ul className="divide-y divide-white/5">
            {candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 py-3 text-left hover:opacity-80"
                  onClick={() => pick(c)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white">{c.name}</div>
                    <div className="truncate text-xs text-slate-400">
                      {c.institution || "—"} · {c.worksCount} works · {c.citedBy.toLocaleString()} cites
                    </div>
                    {c.topics.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.topics.map((t, i) => (
                          <Chip key={i}>{t}</Chip>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-slate-500">→</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading === "dossier" ? (
        <div className="card flex items-center gap-3 p-5 text-slate-300">
          <Spinner /> Building dossier…
        </div>
      ) : null}

      {dossier ? <Dossier dossier={dossier} taste={taste} tasteNote={tasteNote} /> : null}
    </div>
  );
}

function Dossier({
  dossier,
  taste,
  tasteNote,
}: {
  dossier: AuthorDossier;
  taste: ResearchTaste | null;
  tasteNote: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <SectionTitle hint={`${dossier.worksCount} works · ${dossier.citedBy.toLocaleString()} cites${dossier.hIndex ? ` · h-index ${dossier.hIndex}` : ""}`}>
          {dossier.name}
        </SectionTitle>
        {dossier.affiliations.length ? (
          <div className="mb-3">
            <div className="label">Affiliations / labs</div>
            <ul className="text-sm text-slate-300">
              {dossier.affiliations.map((a, i) => (
                <li key={i}>
                  {a.institution}
                  {a.years.length ? (
                    <span className="text-slate-500"> ({Math.min(...a.years)}–{Math.max(...a.years)})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {dossier.topics.length ? (
          <div className="flex flex-wrap gap-1.5">
            {dossier.topics.map((t, i) => (
              <Chip key={i}>{t}</Chip>
            ))}
          </div>
        ) : null}
      </div>

      {taste ? (
        <div className="card space-y-4 p-5">
          <SectionTitle hint="Inferred from their publications">Research taste</SectionTitle>
          {taste.trajectory ? <p className="text-sm text-slate-200">{taste.trajectory}</p> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <TasteList title="Themes" items={taste.themes} />
            <TasteList title="Methods" items={taste.methods} />
          </div>
          {taste.talkingPoints.length ? (
            <div>
              <div className="label flex items-center justify-between">
                <span>Outreach talking points</span>
                <CopyButton text={taste.talkingPoints.map((t) => `• ${t}`).join("\n")} />
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                {taste.talkingPoints.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : tasteNote ? (
        <div className="card p-5 text-sm text-slate-400">{tasteNote}</div>
      ) : null}

      <div className="card p-5">
        <div className="label mb-2">Selected publications</div>
        <ul className="space-y-2 text-sm">
          {dossier.publications.map((p, i) => (
            <li key={i} className="text-slate-300">
              <span className="text-white">{p.title}</span>
              <span className="text-slate-500">
                {" "}
                — {p.venue || "?"} {p.year ? `(${p.year})` : ""} · {p.citedBy} cites
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TasteList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="label">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <Chip key={i} tone="brand">
            {it}
          </Chip>
        ))}
      </div>
    </div>
  );
}
