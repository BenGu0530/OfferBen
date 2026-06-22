"use client";

import { useState, type ReactNode } from "react";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
      {message}
    </div>
  );
}

type Tone = "neutral" | "good" | "bad" | "brand";

const TONES: Record<Tone, string> = {
  neutral: "border-white/15 bg-white/5 text-slate-300",
  good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  bad: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  brand: "border-brand-400/40 bg-brand-500/15 text-brand-100",
};

export function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return <span className={`chip ${TONES[tone]}`}>{children}</span>;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost px-2.5 py-1 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* ignore */
        }
      }}
    >
      {done ? "Copied!" : label}
    </button>
  );
}

export function SectionTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-semibold text-white">{children}</h2>
      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
    </div>
  );
}
