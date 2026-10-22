import { z } from "zod";

/** A concrete thing the company sells or builds. Names matter — "ReCAST's
 *  Foundry cell" is a hook; "innovative hardware" is filler. */
export const CompanyProductSchema = z.object({
  name: z.string().default(""),
  /** What it actually does, in one plain sentence. */
  what: z.string().default(""),
  /** Who it's for / what problem it solves. */
  forWho: z.string().default(""),
});
export type CompanyProduct = z.infer<typeof CompanyProductSchema>;

/**
 * What we learned about a company from its OWN website, distilled by the model.
 *
 * Every field is grounded in fetched page text — the summarizer is told to leave
 * a field empty rather than guess, so an empty `products` means "their site
 * didn't say", not "they have none". The letter writer is told the same thing,
 * which is what keeps a specific cover letter from turning into a confident
 * wrong one.
 */
export const CompanyBriefSchema = z.object({
  name: z.string().default(""),
  /** Resolved homepage we actually fetched, "" if we never found one. */
  website: z.string().default(""),
  /** One sentence: what the company does. */
  oneLiner: z.string().default(""),
  products: z.array(CompanyProductSchema).default([]),
  /** Concrete technologies/techniques named on the site. */
  tech: z.array(z.string()).default([]),
  /** How they position themselves against alternatives. */
  differentiators: z.array(z.string()).default([]),
  /** Launches, funding, customers, papers — anything dated on the site. */
  recent: z.array(z.string()).default([]),
  /** Mission/values language, useful for tone matching. */
  mission: z.string().default(""),
  /** The URLs we actually read, so a letter's claims can be traced back. */
  sources: z.array(z.string()).default([]),
});
export type CompanyBrief = z.infer<typeof CompanyBriefSchema>;
