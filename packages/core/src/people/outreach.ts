import type { AIProvider } from "../ai/provider";
import type { Profile } from "../schema/profile";
import type { AuthorDossier, ResearchTaste } from "./research";
import { compactProfile } from "../util/object";

/**
 * Turn a researched person (their schools/labs/publications + inferred research
 * taste) plus the user's own profile into a short, specific outreach message.
 * This is the bridge from "research a person" (#5) to real action — and the
 * compliant, academic-leaning differentiator: grounded in real publications,
 * not LinkedIn scraping.
 */

export type OutreachKind = "referral" | "research";

const SYSTEM =
  "You write short, genuine, specific outreach messages a job-seeker or prospective " +
  "researcher sends to someone they've researched. Ground every message in the recipient's " +
  "ACTUAL work and the sender's REAL background. Reference a concrete paper/theme of theirs. " +
  "No generic flattery, no fabrication, no buzzword soup. Warm, concise, easy to say yes to.";

export interface PersonOutreachInput {
  profile: Profile;
  person: AuthorDossier;
  taste?: ResearchTaste | null;
  kind: OutreachKind;
}

export async function writePersonOutreach(
  ai: AIProvider,
  { profile, person, taste, kind }: PersonOutreachInput,
): Promise<string> {
  const ask =
    kind === "research"
      ? "The sender is exploring research / PhD / collaboration opportunities and genuinely admires the recipient's work. Make a thoughtful opener that connects the sender's background to the recipient's research and asks (modestly) to learn more or explore working together."
      : "The sender is interested in a role at the recipient's organization. Ask for a brief chat or a referral, framed around shared technical interests — not a cold demand.";

  const pubs = person.publications
    .slice(0, 5)
    .map((p) => `- ${p.title}${p.year ? ` (${p.year})` : ""}`)
    .join("\n");

  const prompt = [
    `Write a ${kind === "research" ? "research-interest" : "referral/outreach"} message (<=160 words).`,
    ask,
    "",
    "Requirements:",
    "- Open by referencing ONE specific paper or theme of the recipient's (use the lists below).",
    "- Connect it to something the sender has genuinely done.",
    "- One clear, modest ask. Sign off with the sender's name. No subject line unless it's an email.",
    "- Never invent the sender's or recipient's work.",
    "",
    `=== RECIPIENT: ${person.name} ===`,
    `Fields: ${person.topics.join(", ")}`,
    `Affiliations: ${person.affiliations.map((a) => a.institution).join("; ")}`,
    taste?.themes?.length ? `Research themes: ${taste.themes.join(", ")}` : "",
    taste?.talkingPoints?.length ? `Talking points: ${taste.talkingPoints.join(" | ")}` : "",
    "Selected publications:",
    pubs,
    "",
    "=== SENDER (the user) ===",
    JSON.stringify(compactProfile(profile)),
  ].join("\n");

  return ai.generateText({ system: SYSTEM, prompt, temperature: 0.6 });
}
