import type { AIProvider } from "../ai/provider";
import type { Job, ParsedJob } from "../schema/job";
import type { MatchResult } from "../schema/match";
import type { Profile } from "../schema/profile";
import { TailoredResumeSchema, type TailoredResume } from "../schema/generation";
import { compactProfile } from "../util/object";

const SYSTEM =
  "You are an expert resume writer and career coach. You CURATE a resume for a specific job: " +
  "you choose which experiences and projects to show, drop the ones that don't help, order the " +
  "strongest-fit items first, and reword bullets — all strictly truthfully. A recruiter skims " +
  "for seconds, so relevance and ordering matter as much as wording.";

const SCHEMA_HINT = `{
  "profile": { ...same schema as the input profile, but work[] and projects[] contain ONLY the items
               worth showing for this role, ordered most-relevant-first, with reworded highlights... },
  "dropped": [ { "kind": "work" | "project", "title": string, "reason": string } ], // items you left OFF and why
  "emphasis": [string],    // keywords you surfaced for this role
  "changeNotes": [string]  // short notes on selection/ordering/wording choices
}`;

export interface TailorResumeInput {
  profile: Profile;
  job: Job;
  parsed?: ParsedJob;
  match?: MatchResult;
  /** Target length in pages (1 or 2). Drives how aggressively to cut. */
  pageTarget?: 1 | 2;
}

export async function tailorResume(
  ai: AIProvider,
  { profile, job, parsed, match, pageTarget = 2 }: TailorResumeInput,
): Promise<TailoredResume> {
  // Concrete content budget — "1 page" alone isn't enough for the model to
  // gauge rendered length, so give it hard counts.
  const budget =
    pageTarget === 1
      ? "ONE page (~45-55 lines): keep AT MOST 3 experiences and 2 projects, <=3 bullets each, summary <=2 lines. Cut hard — drop weaker items entirely."
      : "TWO pages: at most ~5 experiences and ~4 projects, <=4 bullets each, summary <=3 lines.";

  const prompt = [
    "CURATE the candidate's resume for the target job — don't just dump everything in.",
    "",
    "HARD RULES:",
    "- Never fabricate employers, titles, dates, degrees, certifications, or metrics.",
    "- Only surface skills/keywords the candidate genuinely demonstrates somewhere.",
    "- Never invent experiences or projects. You may only SELECT, DROP, REORDER, and REWORD existing ones.",
    "",
    "CURATION:",
    `- LENGTH BUDGET — ${budget}`,
    "- SELECT the work & projects that best support THIS role; DROP the ones that don't add value",
    "  for it (e.g. unrelated domains). Put every dropped item in `dropped` with a one-line reason.",
    "- ORDER the kept work[] and projects[] most-relevant-first, so the recruiter sees the",
    "  strongest fit immediately.",
    "- REWORD highlights to lead with impact and weave in the job's terminology naturally.",
    "- Tighten `basics.summary` into a 2-3 sentence pitch aimed at THIS role.",
    "- Keep education/skills, but order skills by relevance. ATS-safe: plain bullets, standard sections.",
    "- profile.work[] and profile.projects[] must contain ONLY the kept items, in final order.",
    "",
    "=== TARGET JOB ===",
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    parsed ? `Key requirements: ${parsed.requiredSkills.join(", ")}` : "",
    parsed ? `ATS keywords: ${parsed.keywords.join(", ")}` : "",
    match && match.missingKeywords.length
      ? `Known gaps to address honestly (do NOT fake): ${match.missingKeywords.join(", ")}`
      : "",
    "Description:",
    job.description,
    "",
    "=== CURRENT PROFILE (JSON) ===",
    JSON.stringify(compactProfile(profile)),
  ].join("\n");

  const result = await ai.generateJSON(
    { system: SYSTEM, prompt, schemaHint: SCHEMA_HINT, temperature: 0.4 },
    (raw) => TailoredResumeSchema.parse(raw),
  );

  // The model can't measure rendered page length, so it routinely overshoots
  // the budget (e.g. keeps 3 projects when asked for 2). Enforce the counts
  // deterministically after the fact — anything trimmed is recorded in
  // `dropped` so the UI still shows what was cut and why.
  return enforcePageBudget(result, pageTarget);
}

/** Exported for tests. */
export function enforcePageBudget(r: TailoredResume, target: 1 | 2): TailoredResume {
  const maxWork = target === 1 ? 3 : 6;
  const maxProj = target === 1 ? 2 : 4;
  const maxBullets = target === 1 ? 3 : 5;
  const p = r.profile;
  const reason = `Trimmed to fit ${target} page${target > 1 ? "s" : ""}.`;
  const dropped = [...r.dropped];
  for (const w of p.work.slice(maxWork)) {
    dropped.push({ kind: "work", title: [w.position, w.name].filter(Boolean).join(" @ "), reason });
  }
  for (const pr of p.projects.slice(maxProj)) {
    dropped.push({ kind: "project", title: pr.name || "", reason });
  }
  return {
    ...r,
    dropped,
    profile: {
      ...p,
      work: p.work.slice(0, maxWork).map((w) => ({ ...w, highlights: w.highlights.slice(0, maxBullets) })),
      projects: p.projects
        .slice(0, maxProj)
        .map((pr) => ({ ...pr, highlights: pr.highlights.slice(0, maxBullets) })),
      publications: target === 1 ? p.publications.slice(0, 3) : p.publications,
      awards: target === 1 ? p.awards.slice(0, 3) : p.awards,
    },
  };
}
