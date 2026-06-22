import { z } from "zod";

/** Raw job posting captured from a career page or pasted by the user. */
export const JobSchema = z.object({
  title: z.string().default(""),
  company: z.string().default(""),
  location: z.string().optional(),
  url: z.string().optional(),
  source: z.string().optional(),
  /** Raw job description text. */
  description: z.string().default(""),
});
export type Job = z.infer<typeof JobSchema>;

/** Structured analysis of a job description produced by the LLM. */
export const ParsedJobSchema = z.object({
  title: z.string().default(""),
  company: z.string().default(""),
  seniority: z.string().optional(),
  summary: z.string().default(""),
  responsibilities: z.array(z.string()).default([]),
  requiredSkills: z.array(z.string()).default([]),
  niceToHaveSkills: z.array(z.string()).default([]),
  qualifications: z.array(z.string()).default([]),
  /** The ATS keywords worth optimizing the resume for. */
  keywords: z.array(z.string()).default([]),
});
export type ParsedJob = z.infer<typeof ParsedJobSchema>;
