import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Basics } from "@offerben/core";

// Server-only: `renderToBuffer` comes from react-pdf's node entry. Never import
// this from a client component (see CLAUDE.md invariant #2).

// Business-letter defaults: Helvetica, 1" margins, 11pt/1.5 — plain enough that
// an ATS or a human reader both get clean text out of it.
const styles = StyleSheet.create({
  page: {
    paddingVertical: 72,
    paddingHorizontal: 72,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#1a1a1a",
    lineHeight: 1.5,
  },
  name: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  contact: { fontSize: 9.5, color: "#555", marginTop: 3 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#dddddd", marginTop: 10, marginBottom: 16 },
  meta: { fontSize: 10, color: "#666", marginBottom: 14 },
  para: { marginBottom: 10 },
  subject: { fontFamily: "Helvetica-Bold", marginBottom: 10 },
});

function contactLine(basics: Basics | undefined): string {
  const loc = basics?.location;
  const place = [loc?.city, loc?.region, loc?.countryCode].filter(Boolean).join(", ");
  return [basics?.email, basics?.phone, basics?.url, place].filter(Boolean).join("  ·  ");
}

/** Blank-line-separated blocks, so the PDF keeps the paragraphing the model wrote. */
function paragraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

export interface LetterPdfInput {
  text: string;
  basics?: Basics;
  /** e.g. "Robot Learning Engineer" — shown in the dateline block. */
  jobTitle?: string;
  company?: string;
}

function LetterDocument({ text, basics, jobTitle, company }: LetterPdfInput) {
  const paras = paragraphs(text);
  // A recruiter email leads with "Subject: ..." — bold it instead of burying it
  // in the first paragraph.
  const subject = paras[0]?.startsWith("Subject:") ? paras.shift() : null;
  const contact = contactLine(basics);
  const re = [jobTitle, company].filter(Boolean).join(" — ");

  return (
    <Document
      title={[basics?.name, re].filter(Boolean).join(" — ") || "Cover letter"}
      author={basics?.name || undefined}
    >
      <Page size="LETTER" style={styles.page}>
        {basics?.name ? (
          <View>
            <Text style={styles.name}>{basics.name}</Text>
            {contact ? <Text style={styles.contact}>{contact}</Text> : null}
            <View style={styles.rule} />
          </View>
        ) : null}

        <Text style={styles.meta}>
          {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          {re ? `\nRe: ${re}` : ""}
        </Text>

        {subject ? <Text style={styles.subject}>{subject}</Text> : null}

        {paras.map((p, i) => (
          <Text key={i} style={styles.para}>
            {p}
          </Text>
        ))}
      </Page>
    </Document>
  );
}

export function renderLetterPdf(input: LetterPdfInput): Promise<Buffer> {
  return renderToBuffer(<LetterDocument {...input} />);
}

/** A safe, descriptive download name: "Ben-Gu-Cover-Letter-ReCAST-Robotics.pdf". */
export function letterFilename(parts: Array<string | undefined>): string {
  const slug = parts
    .filter(Boolean)
    .join("-")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 90);
  return `${slug || "letter"}.pdf`;
}
