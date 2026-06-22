"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Job, MatchResult, ParsedJob, Profile } from "@/lib/types";
import { Chip, ErrorBanner, SectionTitle, Spinner } from "./ui";

export function MatchStep({
  profile,
  job,
  match,
  onResult,
  onBack,
  onNext,
}: {
  profile: Profile;
  job: Job;
  match: MatchResult | null;
  onResult: (parsed: ParsedJob, match: MatchResult) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  async function run() {
    setError(null);
    setLoading(true);
    try {
      const { parsed, match: m } = await api.match({ profile, job });
      onResult(parsed, m);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Match failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!match && !ran.current) {
      ran.current = true;
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <SectionTitle hint={`${job.title || "Role"} ${job.company ? "· " + job.company : ""}`}>
          Match analysis
        </SectionTitle>

        {loading ? (
          <div className="flex items-center gap-3 py-10 text-slate-300">
            <Spinner /> Analyzing fit against the job…
          </div>
        ) : error ? (
          <div className="space-y-3 py-4">
            <ErrorBanner message={error} />
            <button type="button" className="btn-primary" onClick={run}>
              Try again
            </button>
          </div>
        ) : match ? (
          <MatchView match={match} />
        ) : (
          <button type="button" className="btn-primary" onClick={run}>
            Run match analysis
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <div className="flex gap-2">
          {match ? (
            <button type="button" className="btn-ghost" onClick={run} disabled={loading}>
              Re-run
            </button>
          ) : null}
          <button
            type="button"
            className="btn-primary"
            disabled={!match}
            onClick={onNext}
          >
            Generate documents →
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchView({ match }: { match: MatchResult }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <ScoreRing score={match.score} />
        <div className="flex-1">
          {match.verdict ? (
            <div className="text-lg font-semibold text-white">{match.verdict}</div>
          ) : null}
          {match.summary ? (
            <p className="mt-1 text-sm text-slate-300">{match.summary}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <KeywordList title="Matched keywords" items={match.matchedKeywords} tone="good" />
        <KeywordList title="Missing keywords" items={match.missingKeywords} tone="bad" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BulletList title="Strengths" items={match.strengths} />
        <BulletList title="Gaps" items={match.gaps} />
      </div>

      {match.suggestions.length ? (
        <BulletList title="Suggestions" items={match.suggestions} />
      ) : null}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * c;
  const color =
    pct >= 75 ? "#34d399" : pct >= 50 ? "#818cf8" : "#fbbf24";
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 110 110" className="h-28 w-28 -rotate-90">
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{pct}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">match</span>
      </div>
    </div>
  );
}

function KeywordList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "good" | "bad";
}) {
  return (
    <div>
      <div className="label">{title}</div>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((k, i) => (
            <Chip key={i} tone={tone}>
              {k}
            </Chip>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">None</p>
      )}
    </div>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="label">{title}</div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
