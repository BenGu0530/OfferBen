"use client";

import { storage } from "@/lib/storage";
import { APPLICATION_STATUSES } from "@/lib/types";
import type { ApplicationRecord, ApplicationStatus } from "@/lib/types";
import { SectionTitle } from "./ui";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  rejected: "Rejected",
  offer: "Offer",
};

const STATUS_TONE: Record<ApplicationStatus, string> = {
  saved: "text-slate-300",
  applied: "text-sky-300",
  interviewing: "text-brand-200",
  rejected: "text-red-300",
  offer: "text-emerald-300",
};

function scoreColor(score?: number): string {
  if (score == null) return "border-white/15 text-slate-400";
  if (score >= 75) return "border-emerald-500/40 text-emerald-300";
  if (score >= 50) return "border-brand-400/40 text-brand-200";
  return "border-amber-500/40 text-amber-300";
}

export function ApplicationsView({
  applications,
  onChange,
}: {
  applications: ApplicationRecord[];
  onChange: (list: ApplicationRecord[]) => void;
}) {
  function setStatus(rec: ApplicationRecord, status: ApplicationStatus) {
    onChange(
      storage.saveApplication({ ...rec, status, updatedAt: new Date().toISOString() }),
    );
  }
  function remove(id: string) {
    onChange(storage.removeApplication(id));
  }

  return (
    <div className="card p-5">
      <SectionTitle hint={`${applications.length} tracked`}>Applications</SectionTitle>

      {applications.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          No applications yet. Run a match and click <b>Save to tracker</b> to start
          building your history.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {applications.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${scoreColor(a.score)}`}
                title="Match score"
              >
                {a.score ?? "–"}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-white">
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {a.title || "Untitled role"}
                    </a>
                  ) : (
                    a.title || "Untitled role"
                  )}
                </div>
                <div className="truncate text-xs text-slate-400">
                  {a.company || "—"}
                  {a.verdict ? ` · ${a.verdict}` : ""}
                  {` · ${new Date(a.updatedAt).toLocaleDateString()}`}
                </div>
              </div>

              <select
                value={a.status}
                onChange={(e) => setStatus(a, e.target.value as ApplicationStatus)}
                className={`input w-auto cursor-pointer py-1 text-xs ${STATUS_TONE[a.status]}`}
              >
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s} value={s} className="bg-slate-900 text-slate-200">
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs text-slate-400"
                onClick={() => remove(a.id)}
                title="Remove"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
