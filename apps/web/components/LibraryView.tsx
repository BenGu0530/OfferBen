"use client";

import { useCallback, useEffect, useState, type DragEvent } from "react";
import { fileToBase64, libraryApi, type LibraryPayload } from "@/lib/client";
import {
  ENTRY_KINDS,
  type DraftRecord,
  type EntryKind,
  type Fact,
  type Library,
  type LibraryEntry,
  type Profile,
  type ProposalOp,
} from "@/lib/types";
import { LibraryResume } from "./LibraryResume";
import { Chip, ErrorBanner, SectionTitle, Spinner } from "./ui";

const KIND_LABEL: Record<EntryKind, string> = {
  education: "Degree",
  position: "Position",
  project: "Project",
  publication: "Publication",
  demo: "Public demo",
  talk: "Talk",
  award: "Award",
};

const uid = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;

function blankEntry(kind: EntryKind): LibraryEntry {
  return {
    id: uid(kind.slice(0, 3)),
    kind,
    section: "experience",
    parentId: "",
    title: "",
    org: "",
    subtitle: "",
    location: "",
    start: "",
    end: "",
    date: "",
    venue: "",
    role: "",
    gpa: "",
    url: "",
    urlLabel: "",
    facts: [],
    media: [],
    tags: [],
    sources: [],
    hidden: false,
    updatedAt: new Date().toISOString(),
  };
}

/** Keep fact ids stable across edits so resumes that cite them stay valid. */
function linesToFacts(lines: string[], prev: Fact[]): Fact[] {
  const byText = new Map(prev.map((f) => [f.text, f]));
  const used = new Set<string>();
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((t, i) => {
      const same = byText.get(t);
      if (same && !used.has(same.id)) {
        used.add(same.id);
        return same;
      }
      const atIndex = prev[i];
      if (atIndex && !used.has(atIndex.id)) {
        used.add(atIndex.id);
        return { ...atIndex, text: t };
      }
      return { id: uid("f"), text: t, source: "" };
    });
}

const dateText = (e: LibraryEntry) => [e.start, e.end].filter(Boolean).join(" – ") || e.date;

/** Where an entry shows up in the tree (mirrors core's homeSection). */
function groupOf(e: LibraryEntry, lib: Library): string | null {
  const parent = e.parentId ? lib.entries.find((p) => p.id === e.parentId) : undefined;
  if (parent) return null; // rendered under its parent
  if (e.kind === "position") return e.section === "research" ? "Research" : "Experience";
  return {
    education: "Education",
    project: "Projects",
    publication: "Publications",
    demo: "Public demos",
    talk: "Talks",
    award: "Awards",
  }[e.kind as Exclude<EntryKind, "position">];
}
const GROUPS = [
  "Education",
  "Experience",
  "Research",
  "Projects",
  "Publications",
  "Public demos",
  "Talks",
  "Awards",
];

// --- proposal review -------------------------------------------------------------

function opSummary(op: ProposalOp, lib: Library, draft: DraftRecord): string {
  const name = (id: string) => {
    const hit = lib.entries.find((e) => e.id === id);
    if (hit) return `"${hit.title || hit.venue}"`;
    const temp = draft.proposal.ops.find((o) => o.entry?.tempId === id)?.entry;
    return temp ? `"${temp.title || temp.venue}" (new)` : id || "top level";
  };
  switch (op.op) {
    case "add": {
      const e = op.entry;
      if (!e) return "Add (empty)";
      const bits = [e.org, [e.start, e.end].filter(Boolean).join(" – ") || e.date, e.venue]
        .filter(Boolean)
        .join(" · ");
      return `New ${KIND_LABEL[e.kind].toLowerCase()}: "${e.title || e.venue}"${bits ? ` — ${bits}` : ""}${e.parentId ? ` · under ${name(e.parentId)}` : ""}`;
    }
    case "addFacts":
      return `Add ${op.facts.length} fact(s) to ${name(op.entryId)}`;
    case "attachMedia":
      return `Attach this image to ${name(op.entryId)}`;
    case "skills":
      return `Skills: ${op.skills.map((g) => `${g.name} (${g.keywords.length})`).join(", ")}`;
    case "basics":
      return `Name / contacts: ${op.basics?.name ?? ""}`;
  }
}

function DraftCard({
  draft,
  lib,
  busy,
  onResolve,
}: {
  draft: DraftRecord;
  lib: Library;
  busy: boolean;
  onResolve: (action: "apply" | "discard", accept: number[], notes: Record<number, string>) => void;
}) {
  const [accept, setAccept] = useState<Set<number>>(
    () => new Set(draft.proposal.ops.map((_, i) => i)),
  );
  const [notes, setNotes] = useState<Record<number, string>>({});
  const isImage = draft.fileMime.startsWith("image/");

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <div className="mb-2 flex items-start gap-3">
        {isImage ? (
          <img
            src={`/api/library/file?h=${draft.fileHash}`}
            alt=""
            className="h-20 w-20 rounded-lg object-cover"
          />
        ) : null}
        <div>
          <div className="text-sm font-semibold text-white">{draft.fileName}</div>
          <div className="text-xs text-slate-400">{draft.proposal.summary}</div>
        </div>
      </div>
      <ul className="space-y-2">
        {draft.proposal.ops.map((op, i) => {
          const facts = op.op === "add" ? (op.entry?.facts ?? []) : op.facts;
          const question =
            op.question ||
            (op.op === "attachMedia" ? "What does this show / what did you do?" : "");
          return (
            <li key={i} className="rounded-lg bg-white/[0.03] p-2.5">
              <label className="flex items-start gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={accept.has(i)}
                  onChange={(e) => {
                    const next = new Set(accept);
                    if (e.target.checked) next.add(i);
                    else next.delete(i);
                    setAccept(next);
                  }}
                />
                <span>{opSummary(op, lib, draft)}</span>
              </label>
              {facts.length ? (
                <ul className="ml-6 mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-400">
                  {facts.map((f, j) => (
                    <li key={j}>{f}</li>
                  ))}
                </ul>
              ) : null}
              {op.op === "attachMedia" && op.caption ? (
                <div className="ml-6 mt-1 text-xs italic text-slate-400">{op.caption}</div>
              ) : null}
              {question && accept.has(i) ? (
                <input
                  className="input ml-6 mt-2 w-[calc(100%-1.5rem)] text-xs"
                  placeholder={question}
                  value={notes[i] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [i]: e.target.value })}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => onResolve("apply", [...accept], notes)}
        >
          Add {accept.size} to library
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => onResolve("discard", [], {})}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

// --- entry editor ----------------------------------------------------------------

function EntryEditor({
  entry,
  lib,
  onChange,
  onDelete,
}: {
  entry: LibraryEntry;
  lib: Library;
  onChange: (e: LibraryEntry) => void;
  onDelete: () => void;
}) {
  const [factsText, setFactsText] = useState(entry.facts.map((f) => f.text).join("\n"));
  const set = (patch: Partial<LibraryEntry>) =>
    onChange({ ...entry, ...patch, updatedAt: new Date().toISOString() });
  const parents = lib.entries.filter(
    (p) =>
      p.id !== entry.id &&
      (entry.kind === "project" ? p.kind === "position" : p.kind === "project"),
  );
  const field = (k: keyof LibraryEntry, label: string, placeholder = "") => (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="input"
        value={String(entry[k] ?? "")}
        placeholder={placeholder}
        onChange={(e) => set({ [k]: e.target.value })}
      />
    </label>
  );

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-brand-400/20 bg-slate-950/40 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label">Kind</span>
          <select
            className="input"
            value={entry.kind}
            onChange={(e) => set({ kind: e.target.value as EntryKind })}
          >
            {ENTRY_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        {entry.kind === "position" ? (
          <label className="block">
            <span className="label">Section</span>
            <select
              className="input"
              value={entry.section}
              onChange={(e) => set({ section: e.target.value as "experience" | "research" })}
            >
              <option value="experience">Experience</option>
              <option value="research">Research</option>
            </select>
          </label>
        ) : entry.kind !== "education" && entry.kind !== "award" ? (
          <label className="block sm:col-span-2">
            <span className="label">Belongs to</span>
            <select
              className="input"
              value={entry.parentId}
              onChange={(e) => set({ parentId: e.target.value })}
            >
              <option value="">— top level —</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || p.venue}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field(
          "title",
          entry.kind === "publication"
            ? "Paper title"
            : entry.kind === "education"
              ? "Degree"
              : "Title / role",
        )}
        {field("org", entry.kind === "education" ? "Institution" : "Org / lab / company")}
        {field("subtitle", "Second line", "PI: … / Course Project, …")}
        {field("location", "Location")}
        {entry.kind === "publication" ||
        entry.kind === "demo" ||
        entry.kind === "talk" ||
        entry.kind === "award" ? (
          <>
            {field("venue", entry.kind === "publication" ? "Venue / status" : "Event")}
            {field("date", "Date")}
          </>
        ) : (
          <>
            {field("start", "Start", "Aug 2025")}
            {field("end", "End", "Present")}
          </>
        )}
        {entry.kind === "publication" ? field("role", "Your role", "Co-First Author") : null}
        {entry.kind === "education" ? field("gpa", "GPA", "4.0/4.0") : null}
        {field("url", "Link")}
        {entry.url ? field("urlLabel", "Link text", "arXiv:2609.21185") : null}
      </div>
      <label className="block">
        <span className="label">Facts — one per line (resume bullets are written from these)</span>
        <textarea
          className="input min-h-[110px] font-mono text-xs"
          rows={Math.min(
            16,
            Math.max(4, Math.ceil(factsText.length / 95) + factsText.split("\n").length),
          )}
          value={factsText}
          onChange={(e) => {
            setFactsText(e.target.value);
            set({ facts: linesToFacts(e.target.value.split("\n"), entry.facts) });
          }}
        />
      </label>
      {entry.media.length ? (
        <div className="flex flex-wrap gap-2">
          {entry.media.map((m) => (
            <figure key={m.file} className="w-28">
              <img
                src={`/api/library/file?h=${m.file}`}
                alt={m.caption}
                className="h-20 w-28 rounded object-cover"
              />
              <figcaption className="mt-0.5 line-clamp-2 text-[10px] text-slate-400">
                {m.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={entry.hidden}
            onChange={(e) => set({ hidden: e.target.checked })}
          />
          Hide from resumes
        </label>
        <button
          type="button"
          className="btn-ghost ml-auto px-2.5 py-1 text-xs text-red-300"
          onClick={onDelete}
        >
          Delete entry
        </button>
      </div>
    </div>
  );
}

// --- the view ----------------------------------------------------------------------

export function LibraryView({ onUseAsProfile }: { onUseAsProfile: (p: Profile) => void }) {
  const [data, setData] = useState<LibraryPayload | null>(null);
  const [lib, setLib] = useState<Library | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [basicsText, setBasicsText] = useState("");
  const [skillsText, setSkillsText] = useState("");

  const adopt = useCallback((p: LibraryPayload) => {
    setData(p);
    setLib(p.library);
    setDirty(false);
    setBasicsText(
      p.library.basics.contacts.map((c) => (c.url ? `${c.text} | ${c.url}` : c.text)).join("\n"),
    );
    setSkillsText(
      p.library.skills
        .map((g, i) => `${g.sameLine && i > 0 ? "+" : ""}${g.name}: ${g.keywords.join(", ")}`)
        .join("\n"),
    );
  }, []);

  const load = useCallback(async () => {
    try {
      adopt(await libraryApi.get());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the library.");
    }
  }, [adopt]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(label);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function upload(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    await act("upload", async () => {
      const payload = await Promise.all(
        list.map(async (f) => ({ name: f.name, base64: await fileToBase64(f) })),
      );
      const out = await libraryApi.upload(payload);
      setData((d) => (d ? { ...d, inbox: out.inbox } : d));
      setFlash(`Added ${out.saved.length} file(s) to the inbox.`);
    });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void upload(e.dataTransfer.files);
  }

  const ready = data?.inbox.filter((f) => f.supported) ?? [];

  async function organize() {
    await act("process", async () => {
      const out = await libraryApi.process(Math.min(5, ready.length));
      setData((d) => (d ? { ...d, inbox: out.inbox, drafts: out.drafts } : d));
      const failed = out.processed.filter((p) => p.status === "failed");
      setFlash(
        `${out.processed.filter((p) => p.status === "draft").length} ready to review` +
          (failed.length ? ` · ${failed.length} failed: ${failed[0].error}` : "") +
          (out.stoppedReason ? " · stopped early" : ""),
      );
    });
  }

  async function resolve(
    d: DraftRecord,
    action: "apply" | "discard",
    accept: number[],
    notes: Record<number, string>,
  ) {
    if (
      dirty &&
      action === "apply" &&
      !confirm("You have unsaved edits; applying will reload the library and drop them. Continue?")
    )
      return;
    await act("draft", async () => {
      const out = await libraryApi.draft({ draftId: d.id, action, accept, notes });
      adopt({ ...data!, library: out.library, profile: out.profile, drafts: out.drafts });
      setFlash(out.log.join(" "));
    });
  }

  function update(next: Library) {
    setLib(next);
    setDirty(true);
  }

  function updateEntry(e: LibraryEntry) {
    if (!lib) return;
    update({ ...lib, entries: lib.entries.map((x) => (x.id === e.id ? e : x)) });
  }

  function addEntry(kind: EntryKind) {
    if (!lib) return;
    const e = blankEntry(kind);
    update({ ...lib, entries: [...lib.entries, e] });
    setEditing(e.id);
  }

  function deleteEntry(id: string) {
    if (!lib || !confirm("Delete this entry? Its children are kept and moved to the top level."))
      return;
    update({
      ...lib,
      entries: lib.entries
        .filter((e) => e.id !== id)
        .map((e) => (e.parentId === id ? { ...e, parentId: "" } : e)),
    });
    setEditing(null);
  }

  function applyBasicsAndSkills(l: Library): Library {
    const contacts = basicsText
      .split("\n")
      .map((line) => line.split("|").map((s) => s.trim()))
      .filter(([t]) => t)
      .map(([text, url]) => ({ text, url: url ?? "" }));
    const skills = skillsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes(":"))
      .map((line, i) => {
        const sameLine = line.startsWith("+") && i > 0;
        const [name, rest] = line.replace(/^\+/, "").split(/:(.*)/s);
        return {
          name: name.trim(),
          keywords: rest
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          sameLine,
        };
      });
    return { ...l, basics: { ...l.basics, contacts }, skills };
  }

  async function save() {
    if (!lib) return;
    await act("save", async () => {
      const out = await libraryApi.save(applyBasicsAndSkills(lib));
      adopt({ ...data!, library: out.library, profile: out.profile });
      setFlash("Saved.");
    });
  }

  if (!data || !lib) {
    return (
      <div className="card p-5">
        <ErrorBanner message={error} />
        {!error ? <Spinner className="text-slate-400" /> : null}
      </div>
    );
  }

  const top = (group: string) => lib.entries.filter((e) => groupOf(e, lib) === group);
  const kids = (id: string) => lib.entries.filter((e) => e.parentId === id);

  const row = (e: LibraryEntry, depth: number): JSX.Element => (
    <div key={e.id} style={{ marginLeft: depth * 18 }}>
      <button
        type="button"
        onClick={() => setEditing(editing === e.id ? null : e.id)}
        className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5 ${e.hidden ? "opacity-50" : ""}`}
      >
        <span className="font-medium text-slate-100">{e.title || e.venue || "(untitled)"}</span>
        <span className="truncate text-xs text-slate-400">
          {[
            e.org,
            e.kind !== "position" && e.kind !== "project" && e.kind !== "education"
              ? KIND_LABEL[e.kind]
              : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="ml-auto shrink-0 text-xs text-slate-500">
          {dateText(e)}{" "}
          {e.facts.length ? `· ${e.facts.length} fact${e.facts.length === 1 ? "" : "s"}` : ""}{" "}
          {e.media.length ? `· ${e.media.length} 📷` : ""}
        </span>
      </button>
      {editing === e.id ? (
        <EntryEditor
          key={e.id}
          entry={e}
          lib={lib}
          onChange={updateEntry}
          onDelete={() => deleteEntry(e.id)}
        />
      ) : null}
      {kids(e.id).map((c) => row(c, depth + 1))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-5">
        <SectionTitle
          hint={`${lib.entries.length} entries · ${data.fileCount} file${data.fileCount === 1 ? "" : "s"}`}
        >
          Library
        </SectionTitle>
        <p className="text-sm text-slate-400">
          Drop anything here — papers, posters, old resumes, notes, robot photos. Or put files in{" "}
          <code className="text-slate-300">{data.home}/inbox</code> from Finder. Organizing reads
          each new file once (one AI call per file) and proposes additions for you to approve.
        </p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm transition ${
            dragOver
              ? "border-brand-400 bg-brand-500/10 text-brand-100"
              : "border-white/10 text-slate-400"
          }`}
        >
          <span>Drag files here</span>
          <label className="btn-ghost cursor-pointer px-3 py-1 text-xs">
            or choose files…
            <input
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.txt,.md,.tex,.bib,.csv"
              onChange={(e) => e.target.files && void upload(e.target.files)}
            />
          </label>
          {busy === "upload" ? <Spinner /> : null}
        </div>

        {data.inbox.length ? (
          <div className="space-y-1">
            <span className="label">Inbox</span>
            {data.inbox.map((f) => (
              <div key={f.name} className="flex items-center gap-2 text-xs">
                <span className="text-slate-200">{f.name}</span>
                <span className="text-slate-500">{(f.size / 1024).toFixed(0)} KB</span>
                {f.supported ? <Chip tone="good">ready</Chip> : <Chip tone="bad">{f.reason}</Chip>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Inbox is empty.</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={!ready.length || Boolean(busy)}
            onClick={organize}
          >
            {busy === "process" ? <Spinner /> : null}
            {ready.length
              ? `Organize ${Math.min(5, ready.length)} file${ready.length === 1 ? "" : "s"} (${Math.min(5, ready.length)} AI call${Math.min(5, ready.length) === 1 ? "" : "s"})`
              : "Nothing to organize"}
          </button>
          {flash ? <span className="text-xs text-slate-400">{flash}</span> : null}
        </div>
        <ErrorBanner message={error} />
      </div>

      {data.drafts.length ? (
        <div className="card space-y-3 p-5">
          <SectionTitle hint="Untick anything wrong, answer questions, then add">
            Review ({data.drafts.length})
          </SectionTitle>
          {data.drafts.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              lib={lib}
              busy={Boolean(busy)}
              onResolve={(a, acc, n) => void resolve(d, a, acc, n)}
            />
          ))}
        </div>
      ) : null}

      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <SectionTitle>Entries</SectionTitle>
          <div className="ml-auto flex flex-wrap gap-2">
            <select
              className="input w-auto py-1 text-xs"
              value=""
              onChange={(e) => e.target.value && addEntry(e.target.value as EntryKind)}
            >
              <option value="">+ Add entry…</option>
              {ENTRY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-primary px-3 py-1 text-xs"
              disabled={!dirty || Boolean(busy)}
              onClick={save}
            >
              {busy === "save" ? <Spinner /> : null} {dirty ? "Save changes" : "Saved"}
            </button>
            <button
              type="button"
              className="btn-ghost px-3 py-1 text-xs"
              disabled={dirty || !lib.entries.length}
              title={dirty ? "Save first" : "Score jobs and write letters from the library"}
              onClick={() => {
                onUseAsProfile(data.profile);
                setFlash("Library is now your scoring profile.");
              }}
            >
              Use as my profile
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Name</span>
            <input
              className="input"
              value={lib.basics.name}
              onChange={(e) => update({ ...lib, basics: { ...lib.basics, name: e.target.value } })}
            />
          </label>
          <label className="block">
            <span className="label">Contacts — one per line, "text | link"</span>
            <textarea
              className="input min-h-[84px] font-mono text-xs"
              value={basicsText}
              onChange={(e) => {
                setBasicsText(e.target.value);
                setDirty(true);
              }}
            />
          </label>
        </div>

        {lib.entries.length ? (
          GROUPS.map((g) =>
            top(g).length ? (
              <div key={g}>
                <span className="label">{g}</span>
                {top(g).map((e) => row(e, 0))}
              </div>
            ) : null,
          )
        ) : (
          <p className="text-sm text-slate-500">
            No entries yet. Drop your current resume (.tex or PDF) in to bootstrap.
          </p>
        )}

        <label className="block">
          <span className="label">
            Skills — "Group: a, b, c" per line · start with + to share the previous line
          </span>
          <textarea
            className="input min-h-[100px] font-mono text-xs"
            value={skillsText}
            onChange={(e) => {
              setSkillsText(e.target.value);
              setDirty(true);
            }}
          />
        </label>
      </div>

      {lib.entries.length && !dirty ? <LibraryResume job={null} /> : null}
    </div>
  );
}
