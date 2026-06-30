"use client";

import { useRef, useState } from "react";
import { api, fileToBase64 } from "@/lib/client";
import { pickResumeFromDrive, pickerEnabled } from "@/lib/drivePicker";
import type { Profile } from "@/lib/types";
import { Chip, ErrorBanner, SectionTitle, Spinner } from "./ui";

export function ProfileStep({
  profile,
  onChange,
  onNext,
}: {
  profile: Profile | null;
  onChange: (p: Profile) => void;
  onNext: () => void;
}) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExtract() {
    setError(null);
    setLoading(true);
    try {
      let payload: { text?: string; fileBase64?: string; mimeType?: string } = {};
      if (pendingFile) {
        const isPdf =
          pendingFile.type === "application/pdf" ||
          pendingFile.name.toLowerCase().endsWith(".pdf");
        if (isPdf) {
          payload = {
            fileBase64: await fileToBase64(pendingFile),
            mimeType: "application/pdf",
          };
        } else {
          payload = { text: await pendingFile.text() };
        }
      } else if (text.trim()) {
        payload = { text };
      } else {
        throw new Error("Upload a resume file or paste your resume text.");
      }
      const { profile: p } = await api.extractProfile(payload);
      onChange(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setLoading(false);
    }
  }

  async function importFromDrive() {
    setError(null);
    setLoading(true);
    try {
      const f = await pickResumeFromDrive();
      if (!f) return; // cancelled
      const payload =
        f.mimeType === "application/pdf"
          ? { fileBase64: f.base64, mimeType: "application/pdf" }
          : { text: atob(f.base64) };
      const { profile: p } = await api.extractProfile(payload);
      onChange(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drive import failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <SectionTitle hint="One-time setup">Build your profile</SectionTitle>
        <p className="mb-4 text-sm text-slate-400">
          Upload a resume PDF or your LinkedIn data export (or paste the text). AI
          extracts a structured profile you can reuse for every application.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="label">Upload file</span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.json,application/pdf,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setPendingFile(f);
                setFileName(f?.name ?? null);
              }}
            />
            <button
              type="button"
              className="btn-ghost w-full justify-start"
              onClick={() => fileRef.current?.click()}
            >
              {fileName ?? "Choose a PDF / text file…"}
            </button>
            <p className="mt-1 text-xs text-slate-500">
              Resume PDF, or LinkedIn “Download your data” export.
            </p>
            {pickerEnabled() ? (
              <button
                type="button"
                className="btn-ghost mt-2 w-full justify-start text-sm"
                onClick={importFromDrive}
                disabled={loading}
              >
                ⬇ Import from Google Drive
              </button>
            ) : null}
          </div>

          <div>
            <span className="label">…or paste text</span>
            <textarea
              className="input h-[92px] resize-none scroll-thin"
              placeholder="Paste your resume or LinkedIn profile text here"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={loading}
            onClick={handleExtract}
          >
            {loading ? <Spinner /> : null}
            {loading ? "Extracting…" : "Extract profile"}
          </button>
          {error ? <ErrorBanner message={error} /> : null}
        </div>
      </div>

      {profile ? (
        <ProfileCard profile={profile} onChange={onChange} onNext={onNext} />
      ) : null}
    </div>
  );
}

function ProfileCard({
  profile,
  onChange,
  onNext,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onNext: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="card p-5">
      <SectionTitle hint={editing ? "Fix anything the AI got wrong" : "Looks right? Continue"}>
        {editing ? "Edit profile" : "Extracted profile"}
      </SectionTitle>
      {editing ? (
        <ProfileEditor
          profile={profile}
          onSave={(p) => {
            onChange(p);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <ProfilePreview profile={profile} />
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="btn-primary" onClick={onNext}>
              Continue to job →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function flattenedSkills(profile: Profile): string[] {
  return profile.skills.flatMap((s) => (s.keywords.length ? s.keywords : s.name ? [s.name] : []));
}

function ProfileEditor({
  profile,
  onSave,
  onCancel,
}: {
  profile: Profile;
  onSave: (p: Profile) => void;
  onCancel: () => void;
}) {
  const b = profile.basics;
  const [name, setName] = useState(b.name ?? "");
  const [label, setLabel] = useState(b.label ?? "");
  const [email, setEmail] = useState(b.email ?? "");
  const [phone, setPhone] = useState(b.phone ?? "");
  const [skills, setSkills] = useState(flattenedSkillsText(profile));

  function save() {
    const skillList = skills
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    onSave({
      ...profile,
      basics: { ...profile.basics, name, label, email, phone },
      skills: skillList.map((s) => ({ name: s, keywords: [] })),
    });
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Headline" value={label} onChange={setLabel} placeholder="e.g. Robotics MS @ CMU" />
        <Field label="Email" value={email} onChange={setEmail} />
        <Field label="Phone" value={phone} onChange={setPhone} />
      </div>
      <div>
        <span className="label">Skills (comma or line separated)</span>
        <textarea
          className="input h-28 resize-none scroll-thin"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={save}>
          Save changes
        </button>
      </div>
    </div>
  );
}

function flattenedSkillsText(profile: Profile): string {
  return flattenedSkills(profile).join(", ");
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ProfilePreview({ profile }: { profile: Profile }) {
  const b = profile.basics;
  const skills = profile.skills.flatMap((s) =>
    s.keywords.length ? s.keywords : s.name ? [s.name] : [],
  );
  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="text-base font-semibold text-white">
          {b.name || "Unnamed"}
        </div>
        {b.label ? <div className="text-slate-300">{b.label}</div> : null}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
          {b.email ? <span>{b.email}</span> : null}
          {b.phone ? <span>{b.phone}</span> : null}
          {b.location?.city ? <span>{b.location.city}</span> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={profile.work.length} label="Experiences" />
        <Stat n={profile.education.length} label="Education" />
        <Stat n={skills.length} label="Skills" />
        <Stat n={profile.projects.length} label="Projects" />
      </div>

      {profile.work.length ? (
        <div>
          <div className="label">Experience</div>
          <ul className="space-y-1">
            {profile.work.slice(0, 3).map((w, i) => (
              <li key={i} className="text-slate-300">
                <span className="font-medium text-white">{w.position}</span>
                {w.name ? ` · ${w.name}` : ""}
                {w.startDate || w.endDate ? (
                  <span className="text-slate-500">
                    {" "}
                    ({w.startDate || "?"} – {w.endDate || "Present"})
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {skills.length ? (
        <div>
          <div className="label">Skills</div>
          <div className="flex flex-wrap gap-1.5">
            {skills.slice(0, 18).map((s, i) => (
              <Chip key={i}>{s}</Chip>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-center">
      <div className="text-lg font-semibold text-white">{n}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
