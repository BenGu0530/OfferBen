"use client";

import { useRef, useState } from "react";
import { driveEnabled, loadFromDrive, saveToDrive } from "@/lib/drive";
import { storage } from "@/lib/storage";
import type { Job, Profile } from "@/lib/types";

/**
 * Export / import the local profile + job as a JSON file. This is the lightweight
 * cross-machine backup: export on the old computer, import on the new one — no
 * cloud account required.
 */
export function BackupControls({
  onImported,
}: {
  onImported: (data: { profile: Profile | null; job: Job | null }) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2500);
  }

  async function handleDriveSave() {
    if (!storage.loadProfile()) {
      flash("Build a profile first, then sync");
      return;
    }
    setBusy(true);
    try {
      await saveToDrive(storage.snapshot(), setMsg);
      flash("✓ Synced to your Drive");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Drive sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDriveLoad() {
    setBusy(true);
    try {
      const data = await loadFromDrive(setMsg);
      if (!data) {
        flash("Nothing saved in Drive yet — use Drive ↑ first");
        return;
      }
      storage.restore(data);
      onImported({ profile: data.profile, job: data.job });
      flash(data.profile ? "✓ Loaded from Drive" : "Drive file has no profile yet — build one, then Drive ↑");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Drive load failed");
    } finally {
      setBusy(false);
    }
  }

  function handleExport() {
    const json = storage.exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `offerben-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    flash("Exported");
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const data = storage.importAll(text);
      onImported({ profile: data.profile, job: data.job });
      flash("Imported");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Import failed");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg ? <span className="text-xs text-slate-400">{msg}</span> : null}
      <button
        type="button"
        className="btn-ghost px-2.5 py-1 text-xs"
        onClick={handleExport}
        title="Download your profile + job as a JSON backup"
      >
        Export
      </button>
      <button
        type="button"
        className="btn-ghost px-2.5 py-1 text-xs"
        onClick={() => fileRef.current?.click()}
        title="Restore from a JSON backup"
      >
        Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImport(f);
          e.target.value = "";
        }}
      />
      {driveEnabled() ? (
        <>
          <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />
          <button
            type="button"
            disabled={busy}
            className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-50"
            onClick={() => void handleDriveSave()}
            title="Sync your profile + job to your own Google Drive"
          >
            Drive ↑
          </button>
          <button
            type="button"
            disabled={busy}
            className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-50"
            onClick={() => void handleDriveLoad()}
            title="Load your profile + job from your Google Drive"
          >
            Drive ↓
          </button>
        </>
      ) : null}
    </div>
  );
}
