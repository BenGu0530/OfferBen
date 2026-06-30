"use client";

import { useEffect, useState } from "react";
import { ApplicationsView } from "@/components/ApplicationsView";
import { PeopleView } from "@/components/PeopleView";
import { BackupControls } from "@/components/BackupControls";
import { GenerateStep } from "@/components/GenerateStep";
import { JobStep } from "@/components/JobStep";
import { MatchStep } from "@/components/MatchStep";
import { ProfileStep } from "@/components/ProfileStep";
import { Stepper, type StepDef } from "@/components/Stepper";
import { readJobFromUrl } from "@/lib/handoff";
import { storage } from "@/lib/storage";
import type { ApplicationRecord, Job, MatchResult, ParsedJob, Profile } from "@/lib/types";

const STEPS: StepDef[] = [
  { id: "profile", label: "Profile" },
  { id: "job", label: "Job" },
  { id: "match", label: "Match" },
  { id: "generate", label: "Generate" },
];

const EMPTY_JOB: Job = { title: "", company: "", description: "" };

export default function HomePage() {
  const [step, setStep] = useState(0);
  const [view, setView] = useState<"wizard" | "tracker" | "people">("wizard");
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [job, setJobState] = useState<Job>(EMPTY_JOB);
  const [parsed, setParsed] = useState<ParsedJob | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);

  // hydrate from localStorage once on mount; an incoming job (from the browser
  // extension handoff via URL) takes precedence and jumps straight to the job step.
  useEffect(() => {
    const p = storage.loadProfile();
    if (p) setProfileState(p);
    setApplications(storage.loadApplications());

    void (async () => {
      const incoming = await readJobFromUrl();
      if (incoming) {
        setJobState(incoming);
        storage.saveJob(incoming);
        setStep(p ? 2 : 0);
        return;
      }
      const j = storage.loadJob();
      if (j) setJobState(j);
    })();
  }, []);

  function setProfile(p: Profile) {
    setProfileState(p);
    storage.saveProfile(p);
    setParsed(null);
    setMatch(null);
  }

  function setJob(j: Job) {
    setJobState(j);
    storage.saveJob(j);
    setParsed(null);
    setMatch(null);
  }

  const jobReady = job.description.trim().length > 30;
  const maxReached = !profile ? 0 : !jobReady ? 1 : !match ? 2 : 3;

  function go(i: number) {
    setStep(Math.min(i, maxReached));
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-400 text-lg font-bold text-white shadow-lg">
              O
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">OfferBen</h1>
              <p className="text-xs text-slate-400">
                One profile → a tailored application for any job
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {view === "wizard" ? (
              <>
                <button
                  type="button"
                  className="btn-ghost px-2.5 py-1 text-xs"
                  onClick={() => setView("people")}
                >
                  Research
                </button>
                <button
                  type="button"
                  className="btn-ghost px-2.5 py-1 text-xs"
                  onClick={() => setView("tracker")}
                >
                  Applications ({applications.length})
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-ghost px-2.5 py-1 text-xs"
                onClick={() => setView("wizard")}
              >
                ← Back to wizard
              </button>
            )}
            <BackupControls
              onImported={({ profile: p, job: j }) => {
                if (p) setProfileState(p);
                if (j) setJobState(j);
                setApplications(storage.loadApplications());
                setParsed(null);
                setMatch(null);
                setStep(0);
              }}
            />
            <span className="chip hidden border-white/10 bg-white/5 text-slate-300 sm:inline-flex">
              Local · Gemini
            </span>
          </div>
        </div>
      </header>

      {view === "tracker" ? (
        <ApplicationsView applications={applications} onChange={setApplications} />
      ) : view === "people" ? (
        <PeopleView />
      ) : (
      <>
      <div className="mb-6">
        <Stepper
          steps={STEPS}
          current={step}
          maxReached={maxReached}
          onSelect={go}
        />
      </div>

      {step === 0 && (
        <ProfileStep
          profile={profile}
          onChange={setProfile}
          onNext={() => setStep(1)}
        />
      )}

      {step === 1 && (
        <JobStep
          job={job}
          onChange={setJob}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && profile && (
        <MatchStep
          profile={profile}
          job={job}
          match={match}
          onResult={(p, m) => {
            setParsed(p);
            setMatch(m);
          }}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          onTrackerChange={setApplications}
        />
      )}

      {step === 3 && profile && (
        <GenerateStep
          profile={profile}
          job={job}
          parsed={parsed}
          match={match}
          onBack={() => setStep(2)}
          onTrackerChange={setApplications}
        />
      )}
      </>
      )}

      <footer className="mt-12 text-center text-xs text-slate-600">
        Pure generation · no scraping or automation. Your profile stays in this
        browser. Set <code className="text-slate-400">GEMINI_API_KEY</code> in{" "}
        <code className="text-slate-400">apps/web/.env.local</code>.
      </footer>
    </main>
  );
}
