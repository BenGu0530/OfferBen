import { z } from "zod";

/**
 * Structured candidate profile. Based on the JSON Resume schema
 * (https://jsonresume.org/schema/) with light extensions.
 *
 * Every field is optional or defaulted so that `ProfileSchema.parse()` is tolerant
 * of partial / imperfect LLM output and never throws on missing keys. String
 * leaves use `.nullish()` (not just `.optional()`) so an explicit `null` from the
 * model — e.g. `{"email": null}` — parses through instead of throwing (#34).
 */

export const LocationSchema = z.object({
  city: z.string().nullish(),
  region: z.string().nullish(),
  countryCode: z.string().nullish(),
  address: z.string().nullish(),
  postalCode: z.string().nullish(),
});
export type Location = z.infer<typeof LocationSchema>;

export const ProfileLinkSchema = z.object({
  network: z.string().default(""),
  username: z.string().nullish(),
  url: z.string().nullish(),
});
export type ProfileLink = z.infer<typeof ProfileLinkSchema>;

export const BasicsSchema = z.object({
  name: z.string().default(""),
  /** Headline / professional title, e.g. "Senior Backend Engineer". */
  label: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  url: z.string().nullish(),
  summary: z.string().nullish(),
  location: LocationSchema.optional(),
  profiles: z.array(ProfileLinkSchema).default([]),
});
export type Basics = z.infer<typeof BasicsSchema>;

export const WorkSchema = z.object({
  /** Company / organization name. */
  name: z.string().default(""),
  position: z.string().default(""),
  url: z.string().nullish(),
  location: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  summary: z.string().nullish(),
  highlights: z.array(z.string()).default([]),
});
export type Work = z.infer<typeof WorkSchema>;

export const EducationSchema = z.object({
  institution: z.string().default(""),
  area: z.string().nullish(),
  studyType: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  score: z.string().nullish(),
  courses: z.array(z.string()).default([]),
});
export type Education = z.infer<typeof EducationSchema>;

export const SkillSchema = z.object({
  name: z.string().default(""),
  level: z.string().nullish(),
  keywords: z.array(z.string()).default([]),
});
export type Skill = z.infer<typeof SkillSchema>;

export const ProjectSchema = z.object({
  name: z.string().default(""),
  description: z.string().nullish(),
  url: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  highlights: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CertificateSchema = z.object({
  name: z.string().default(""),
  issuer: z.string().nullish(),
  date: z.string().nullish(),
  url: z.string().nullish(),
});
export type Certificate = z.infer<typeof CertificateSchema>;

export const PublicationSchema = z.object({
  name: z.string().default(""),
  publisher: z.string().nullish(),
  releaseDate: z.string().nullish(),
  url: z.string().nullish(),
  summary: z.string().nullish(),
});
export type Publication = z.infer<typeof PublicationSchema>;

export const AwardSchema = z.object({
  title: z.string().default(""),
  date: z.string().nullish(),
  awarder: z.string().nullish(),
  summary: z.string().nullish(),
});
export type Award = z.infer<typeof AwardSchema>;

export const LanguageSchema = z.object({
  language: z.string().default(""),
  fluency: z.string().nullish(),
});
export type Language = z.infer<typeof LanguageSchema>;

export const ProfileSchema = z.object({
  basics: BasicsSchema.default({ name: "", profiles: [] }),
  work: z.array(WorkSchema).default([]),
  education: z.array(EducationSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  certificates: z.array(CertificateSchema).default([]),
  publications: z.array(PublicationSchema).default([]),
  awards: z.array(AwardSchema).default([]),
  languages: z.array(LanguageSchema).default([]),
});
export type Profile = z.infer<typeof ProfileSchema>;

export function emptyProfile(): Profile {
  return ProfileSchema.parse({});
}
