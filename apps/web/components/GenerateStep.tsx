"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { api } from "@/lib/client";
import type {
  Job,
  MatchResult,
  ParsedJob,
  Profile,
  ReferralQA,
  TailoredResume,
} from "@/lib/types";
import { Chip, CopyButton, ErrorBanner, SectionTitle, Spinner } from "./ui";

const ResumeDownloadButton = dynamic(() => import("./ResumePdf"), {
  ssr: false,
  loading: () => (
    <button type="button" className="btn-ghost" disabled>
      Preparing…
    </button>
  ),
});

type LetterKey = "coverLetter" | "recruiterEmail" | "referralNote";

const LETTER_CARDS: { key: LetterKey; title: string; desc: string }[] = [
  { key: "coverLetter", title: "Cover letter", desc: "Tailored, ~300 words." },
  { key: "recruiterEmail", title: "Recruiter email", desc: "Short cold outreach with a subject line." },
  { key: "referralNote", title: "Referral note", desc: "LinkedIn DM asking for a referral." },
];

function sanitize(s: string): string {
  return (s || "").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "resume";
}

export function GenerateStep({
  profile,
  job,
  parsed,
  match,
  onBack,
}: {
  profile: Profile;
  job: Job;
  parsed: ParsedJob | null;
  match: MatchResult | null;
  onBack: () => void;
}) {
  const [tailored, setTailored] = useState<TailoredResume | null>(null);
  const [letters, setLetters] = useState<Partial<Record<LetterKey, string>>>({});
  const [qa, setQa] = useState<ReferralQA | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setBusy(key: string, v: boolean) {
    setLoading((s) => ({ ...s, [key]: v }));
  }
  function setErr(key: string, v: string) {
    setErrors((s) => ({ ...s, [key]: v }));
  }

  async function runTailor() {
    setErr("tailor", "");
    setBusy("tailor", true);
    try {
      const { resume } = await api.tailor({
        profile,
        job,
        parsed: parsed ?? undefined,
        match: match ?? undefined,
      });
      setTailored(resume);
    } catch (err) {
      setErr("tailor", err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy("tailor", false);
    }
  }

  async function runLetter(key: LetterKey) {
    setErr(key, "");
    setBusy(key, true);
    try {
      const { text } = await api.letter({ profile, job, kind: key });
      setLetters((s) => ({ ...s, [key]: text }));
    } catch (err) {
      setErr(key, err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(key, false);
    }
  }

  async function runQA() {
    setErr("qa", "");
    setBusy("qa", true);
    try {
      const { qa: result } = await api.referralQA({ profile, job });
      setQa(result);
    } catch (err) {
      setErr("qa", err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy("qa", false);
    }
  }

  const fileName = `${sanitize(profile.basics.name)}_${sanitize(job.company || job.title)}.pdf`;
  const resumeProfile = tailored?.profile ?? profile;

  return (
    <div className="space-y-6">
      {/* Tailored resume */}
      <div className="card p-5">
        <SectionTitle hint="Truthful rewrite, reordered for this role">
          Tailored resume
        </SectionTitle>

        {!tailored ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              Rewrite and reorder your resume to emphasize what this job wants —
              without fabricating anything.
            </p>
            <button
              type="button"
              className="btn-primary"
              disabled={loading.tailor}
              onClick={runTailor}
            >
              {loading.tailor ? <Spinner /> : null}
              {loading.tailor ? "Tailoring…" : "Generate tailored resume"}
            </button>
            <ErrorBanner message={errors.tailor} />
          </div>
        ) : (
          <div className="space-y-4">
            {tailored.emphasis.length ? (
              <div>
                <div className="label">Emphasized</div>
                <div className="flex flex-wrap gap-1.5">
                  {tailored.emphasis.map((k, i) => (
                    <Chip key={i} tone="brand">
                      {k}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}

            {tailored.changeNotes.length ? (
              <div>
                <div className="label">What changed</div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                  {tailored.changeNotes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <TailoredPreview resume={tailored} />

            <div className="flex flex-wrap items-center gap-2">
              <ResumeDownloadButton profile={resumeProfile} fileName={fileName} />
              <button
                type="button"
                className="btn-ghost"
                disabled={loading.tailor}
                onClick={runTailor}
              >
                {loading.tailor ? <Spinner /> : null} Regenerate
              </button>
            </div>
            <ErrorBanner message={errors.tailor} />
          </div>
        )}
      </div>

      {/* Letters */}
      <div className="grid gap-4 md:grid-cols-2">
        {LETTER_CARDS.map((card) => (
          <div key={card.key} className="card p-5">
            <SectionTitle hint={card.desc}>{card.title}</SectionTitle>
            {letters[card.key] ? (
              <div className="space-y-2">
                <div className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-slate-900/50 p-3 text-sm text-slate-200 scroll-thin">
                  {letters[card.key]}
                </div>
                <div className="flex gap-2">
                  <CopyButton text={letters[card.key] as string} />
                  <button
                    type="button"
                    className="btn-ghost px-2.5 py-1 text-xs"
                    disabled={loading[card.key]}
                    onClick={() => runLetter(card.key)}
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={loading[card.key]}
                  onClick={() => runLetter(card.key)}
                >
                  {loading[card.key] ? <Spinner /> : null}
                  {loading[card.key] ? "Writing…" : `Generate ${card.title.toLowerCase()}`}
                </button>
                <ErrorBanner message={errors[card.key]} />
              </div>
            )}
          </div>
        ))}

        {/* Referral Q&A */}
        <div className="card p-5">
          <SectionTitle hint="Likely referral questions + draft answers">
            Referral Q&amp;A
          </SectionTitle>
          {qa && qa.items.length ? (
            <div className="space-y-3">
              <div className="max-h-64 space-y-3 overflow-auto pr-1 scroll-thin">
                {qa.items.map((item, i) => (
                  <div key={i}>
                    <div className="text-sm font-medium text-white">
                      {item.question}
                    </div>
                    <div className="text-sm text-slate-300">{item.answer}</div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1 text-xs"
                disabled={loading.qa}
                onClick={runQA}
              >
                Regenerate
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                className="btn-ghost"
                disabled={loading.qa}
                onClick={runQA}
              >
                {loading.qa ? <Spinner /> : null}
                {loading.qa ? "Drafting…" : "Generate referral Q&A"}
              </button>
              <ErrorBanner message={errors.qa} />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Back to match
        </button>
      </div>
    </div>
  );
}

function TailoredPreview({ resume }: { resume: TailoredResume }) {
  const p = resume.profile;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/40 p-4 text-sm">
      {p.basics.summary ? (
        <p className="text-slate-200">{p.basics.summary}</p>
      ) : null}
      {p.work.slice(0, 3).map((w, i) => (
        <div key={i} className="mt-3">
          <div className="font-medium text-white">
            {w.position}
            {w.name ? ` · ${w.name}` : ""}
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-300">
            {w.highlights.slice(0, 3).map((h, j) => (
              <li key={j}>{h}</li>
            ))}
          </ul>
        </div>
      ))}
      <p className="mt-3 text-xs text-slate-500">
        Download the PDF for the full, formatted, ATS-safe resume.
      </p>
    </div>
  );
}
