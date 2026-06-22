import type { Profile, Job, ParsedJob, MatchResult } from "@offerben/core";

/** Row shapes mirroring schema.sql. `data` columns are typed via @offerben/core. */

export interface ProfileRow {
  id: string;
  user_id: string;
  label: string;
  data: Profile;
  created_at: string;
  updated_at: string;
}

export interface JobRow {
  id: string;
  user_id: string;
  title: string;
  company: string;
  url: string | null;
  source: string | null;
  description: string;
  parsed: ParsedJob | null;
  match: MatchResult | null;
  created_at: string;
  updated_at: string;
}

export interface GenerationRow {
  id: string;
  user_id: string;
  job_id: string | null;
  kind: "tailored_resume" | "cover_letter" | "recruiter_email" | "referral_note" | "referral_qa";
  /** Free-form JSON payload (resume profile, letter text, or QA list). */
  content: unknown;
  created_at: string;
}
