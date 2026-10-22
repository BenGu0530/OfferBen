import { NextResponse } from "next/server";
import { ProfileSchema } from "@offerben/core";
import { letterFilename, renderLetterPdf } from "@/lib/letterPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  text: string;
  profile?: unknown;
  jobTitle?: string;
  company?: string;
  kind?: string;
}

const KIND_LABEL: Record<string, string> = {
  coverLetter: "Cover Letter",
  recruiterEmail: "Recruiter Email",
  referralNote: "Referral Note",
};

// No AI call here — this is pure typesetting of text the user already has, so it
// costs nothing against the daily quota. It can't use `jsonHandler` (that wraps
// everything in JSON); the content-type guard below is the same anti-CSRF check.
export async function POST(req: Request): Promise<NextResponse> {
  if (!(req.headers.get("content-type") || "").includes("application/json")) {
    return NextResponse.json({ error: "Expected application/json" }, { status: 415 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = String(body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Nothing to render." }, { status: 400 });

  try {
    const parsed = body.profile ? ProfileSchema.safeParse(body.profile) : null;
    const basics = parsed?.success ? parsed.data.basics : undefined;

    const pdf = await renderLetterPdf({
      text,
      basics,
      jobTitle: body.jobTitle,
      company: body.company,
    });
    const filename = letterFilename([
      basics?.name,
      KIND_LABEL[body.kind || ""] || "Letter",
      body.company,
    ]);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Offerben-Filename": filename,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not render the PDF.";
    console.error("[offerben:api] letters/pdf", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
