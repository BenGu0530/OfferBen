"use client";

export interface StepDef {
  id: string;
  label: string;
}

export function Stepper({
  steps,
  current,
  maxReached,
  onSelect,
}: {
  steps: StepDef[];
  current: number;
  maxReached: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-2">
      {steps.map((step, i) => {
        const active = i === current;
        const reachable = i <= maxReached;
        const done = i < current;
        return (
          <button
            key={step.id}
            type="button"
            disabled={!reachable}
            onClick={() => reachable && onSelect(i)}
            className={[
              "group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
              active
                ? "border-brand-400/60 bg-brand-500/20 text-white"
                : reachable
                  ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  : "cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-600",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                active
                  ? "bg-brand-500 text-white"
                  : done
                    ? "bg-emerald-500/80 text-white"
                    : "bg-white/10 text-slate-300",
              ].join(" ")}
            >
              {done ? "✓" : i + 1}
            </span>
            {step.label}
          </button>
        );
      })}
    </nav>
  );
}
