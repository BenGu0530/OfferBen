import {
  applySectionSet,
  boldJobKeywords,
  createAIProvider,
  defaultDoc,
  JobSchema,
  planResume,
  ResumeDocSchema,
  SECTION_KEYS,
  validateResumeDoc,
  type SectionKey,
} from "@offerben/core";
import { aiConfigFromHeaders, jsonHandler } from "@/lib/server";
import { fitAndCompile } from "@/lib/library/build";
import { readLibrary } from "@/lib/library/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

interface Body {
  /** plan = curate for the job (1 AI call); default = no-AI base resume; render = re-render an edited doc (no AI). */
  mode?: "plan" | "default" | "render";
  job?: unknown;
  doc?: unknown;
  sections?: unknown;
  pageTarget?: number;
}

export const POST = jsonHandler<Body>(async (body, req) => {
  const lib = await readLibrary();
  if (!lib.entries.length)
    throw new Error("Your library is empty — add files in the Library view first.");
  const pageTarget = body.pageTarget === 2 ? 2 : 1;
  const sections = Array.isArray(body.sections)
    ? (body.sections.filter((k) =>
        (SECTION_KEYS as readonly string[]).includes(String(k)),
      ) as SectionKey[])
    : undefined;

  let warnings: string[] = [];
  let doc;
  if (body.mode === "plan") {
    const job = JobSchema.parse(body.job ?? {});
    if (!job.description.trim()) throw new Error("Add a job description first.");
    const ai = createAIProvider(aiConfigFromHeaders(req));
    ({ doc, warnings } = await planResume(ai, { library: lib, job, pageTarget, sections }));
  } else if (body.mode === "render") {
    let d = ResumeDocSchema.parse(body.doc ?? {});
    if (sections) d = applySectionSet(d, lib, sections);
    ({ doc, warnings } = validateResumeDoc(d, lib));
    // Newly toggled-on sections get the same job-relevant bold as the curated ones.
    const job = body.job ? JobSchema.parse(body.job) : null;
    if (job?.description) doc = boldJobKeywords(doc, lib, `${job.title}\n${job.description}`);
  } else {
    let d = defaultDoc(lib);
    if (sections) d = applySectionSet(d, lib, sections);
    doc = d;
  }

  const built = await fitAndCompile(lib, doc, pageTarget);
  return { ...built, warnings };
});
