"use client";

import type { Job } from "@/lib/types";
import { SectionTitle } from "./ui";

export function JobStep({
  job,
  onChange,
  onBack,
  onNext,
}: {
  job: Job;
  onChange: (j: Job) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const canContinue = job.description.trim().length > 30;

  function set<K extends keyof Job>(key: K, value: Job[K]) {
    onChange({ ...job, [key]: value });
  }

  return (
    <div className="card space-y-4 p-5">
      <SectionTitle hint="Paste the role you’re targeting">Target job</SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="label">Job title</span>
          <input
            className="input"
            placeholder="e.g. Senior Backend Engineer"
            value={job.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div>
          <span className="label">Company</span>
          <input
            className="input"
            placeholder="e.g. Acme Corp"
            value={job.company}
            onChange={(e) => set("company", e.target.value)}
          />
        </div>
      </div>

      <div>
        <span className="label">Job posting URL (optional)</span>
        <input
          className="input"
          placeholder="https://…"
          value={job.url ?? ""}
          onChange={(e) => set("url", e.target.value)}
        />
      </div>

      <div>
        <span className="label">Job description *</span>
        <textarea
          className="input h-56 resize-none scroll-thin"
          placeholder="Paste the full job description here…"
          value={job.description}
          onChange={(e) => set("description", e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          {job.description.trim().length} characters
          {canContinue ? "" : " — paste a bit more to continue"}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!canContinue}
          onClick={onNext}
        >
          Score the match →
        </button>
      </div>
    </div>
  );
}
