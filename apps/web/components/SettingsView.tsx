"use client";

import { useState } from "react";
import { loadAISettings, saveAISettings, type AISettings } from "@/lib/aiSettings";
import { SectionTitle } from "./ui";

const PRESETS: Record<AISettings["provider"], { model: string; baseHint: string; keyHint: string }> = {
  gemini: {
    model: "gemini-2.5-flash-lite",
    baseHint: "",
    keyHint: "Get a free key at aistudio.google.com/apikey",
  },
  openai: {
    model: "llama-3.3-70b-versatile",
    baseHint: "https://api.groq.com/openai/v1",
    keyHint: "OpenAI / Groq / OpenRouter / DeepSeek / Ollama key",
  },
};

export function SettingsView({ onSaved }: { onSaved?: () => void }) {
  const [s, setS] = useState<AISettings>(() => loadAISettings());
  const [flash, setFlash] = useState<string | null>(null);

  function set<K extends keyof AISettings>(k: K, v: AISettings[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  function save() {
    saveAISettings(s);
    onSaved?.();
    setFlash("Saved — used on your next request");
    setTimeout(() => setFlash(null), 2500);
  }

  function clearKey() {
    const next = { ...s, apiKey: "" };
    setS(next);
    saveAISettings(next);
    onSaved?.();
    setFlash("Key cleared — falling back to the server key");
    setTimeout(() => setFlash(null), 2500);
  }

  const preset = PRESETS[s.provider];

  return (
    <div className="card space-y-5 p-5">
      <SectionTitle hint="Bring your own key — stays in this browser">AI settings</SectionTitle>

      <p className="text-sm text-slate-400">
        Use your own AI key. It&apos;s stored only in this browser and sent with each
        request for that call — never saved on any server. Leave it blank to use the
        server&apos;s key (the self-host default).
      </p>

      <div>
        <span className="label">Provider</span>
        <div className="flex gap-2">
          {(["gemini", "openai"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={s.provider === p ? "btn-primary px-3 py-1 text-sm" : "btn-ghost px-3 py-1 text-sm"}
              onClick={() => set("provider", p)}
            >
              {p === "gemini" ? "Google Gemini" : "OpenAI-compatible"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">API key</span>
        <input
          className="input"
          type="password"
          autoComplete="off"
          placeholder={preset.keyHint}
          value={s.apiKey}
          onChange={(e) => set("apiKey", e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="label">Model</span>
          <input
            className="input"
            placeholder={preset.model}
            value={s.model}
            onChange={(e) => set("model", e.target.value)}
          />
        </div>
        {s.provider === "openai" ? (
          <div>
            <span className="label">Base URL</span>
            <input
              className="input"
              placeholder={preset.baseHint}
              value={s.baseURL}
              onChange={(e) => set("baseURL", e.target.value)}
            />
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save}>
          Save
        </button>
        {s.apiKey ? (
          <button type="button" className="btn-ghost" onClick={clearKey}>
            Clear key
          </button>
        ) : null}
        {flash ? <span className="text-xs text-slate-400">{flash}</span> : null}
      </div>

      <p className="text-xs text-slate-500">
        {s.provider === "openai"
          ? "Works with OpenAI, Groq, OpenRouter, DeepSeek, or a local Ollama. Set the base URL for non-OpenAI hosts."
          : "Gemini's free tier is ~20 requests/day per model. The app auto-falls-over to other models on overload."}
      </p>
    </div>
  );
}
