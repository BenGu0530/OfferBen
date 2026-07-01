"use client";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { useState } from "react";
import type { Profile } from "@/lib/types";
import { Spinner } from "./ui";

// Single column, standard font (Helvetica is built in), no tables/columns -> ATS-safe.
// Every size/spacing value is multiplied by `scale` so we can auto-fit the
// résumé to fill the target page(s) — a human tightens or loosens density to
// use all the space; `scale` is that knob (see renderFittedResumeBlob).
function makeStyles(scale: number) {
  const r = (n: number) => n * scale;
  return StyleSheet.create({
    page: {
      paddingVertical: r(34),
      paddingHorizontal: r(40),
      fontFamily: "Helvetica",
      fontSize: r(10),
      color: "#1a1a1a",
      lineHeight: 1.4,
    },
    name: { fontSize: r(20), fontFamily: "Helvetica-Bold" },
    label: { fontSize: r(11), color: "#444", marginTop: r(2) },
    contact: { fontSize: r(9), color: "#555", marginTop: r(4) },
    summary: { marginTop: r(8), fontSize: r(10), color: "#222" },
    section: { marginTop: r(14) },
    h2: {
      fontSize: r(11),
      fontFamily: "Helvetica-Bold",
      textTransform: "uppercase",
      letterSpacing: 1,
      borderBottomWidth: 1,
      borderBottomColor: "#cccccc",
      paddingBottom: r(2),
      marginBottom: r(6),
    },
    itemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    itemTitle: { fontSize: r(10.5), fontFamily: "Helvetica-Bold" },
    itemSub: { fontSize: r(10), color: "#333" },
    itemMeta: { fontSize: r(9), color: "#666" },
    bullet: { flexDirection: "row", marginTop: r(2) },
    bulletDot: { width: r(10), fontSize: r(10) },
    bulletText: { flex: 1, fontSize: r(10) },
    skillsRow: { fontSize: r(10), marginTop: r(2) },
    itemBlock: { marginBottom: r(8) },
  });
}

function Bullets({ items, styles }: { items: string[]; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View>
      {items.filter(Boolean).map((it, i) => (
        <View key={i} style={styles.bullet}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

export function ResumeDocument({ profile, scale = 1 }: { profile: Profile; scale?: number }) {
  const styles = makeStyles(scale);
  const b = profile.basics;
  const contactParts = [
    b.email,
    b.phone,
    b.location?.city,
    b.url,
    ...b.profiles.map((p) => p.url || p.username),
  ].filter(Boolean);

  return (
    <Document
      title={`${b.name || "Resume"}`}
      author={b.name || "OfferBen"}
      creator="OfferBen"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{b.name || "Your Name"}</Text>
        {b.label ? <Text style={styles.label}>{b.label}</Text> : null}
        {contactParts.length ? (
          <Text style={styles.contact}>{contactParts.join("  |  ")}</Text>
        ) : null}
        {b.summary ? <Text style={styles.summary}>{b.summary}</Text> : null}

        {profile.work.length ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Experience</Text>
            {profile.work.map((w, i) => (
              <View key={i} style={styles.itemBlock}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>
                    {w.position}
                    {w.name ? ` — ${w.name}` : ""}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {[w.startDate, w.endDate || "Present"].filter(Boolean).join(" – ")}
                  </Text>
                </View>
                {w.location ? <Text style={styles.itemMeta}>{w.location}</Text> : null}
                {w.summary ? <Text style={styles.itemSub}>{w.summary}</Text> : null}
                <Bullets items={w.highlights} styles={styles} />
              </View>
            ))}
          </View>
        ) : null}

        {profile.projects.length ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Projects</Text>
            {profile.projects.map((p, i) => (
              <View key={i} style={styles.itemBlock}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{p.name}</Text>
                  <Text style={styles.itemMeta}>
                    {[p.startDate, p.endDate].filter(Boolean).join(" – ")}
                  </Text>
                </View>
                {p.description ? <Text style={styles.itemSub}>{p.description}</Text> : null}
                <Bullets items={p.highlights} styles={styles} />
              </View>
            ))}
          </View>
        ) : null}

        {profile.education.length ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Education</Text>
            {profile.education.map((e, i) => (
              <View key={i} style={styles.itemBlock}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{e.institution}</Text>
                  <Text style={styles.itemMeta}>
                    {[e.startDate, e.endDate].filter(Boolean).join(" – ")}
                  </Text>
                </View>
                <Text style={styles.itemSub}>
                  {[e.studyType, e.area].filter(Boolean).join(", ")}
                  {e.score ? `  ·  ${e.score}` : ""}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {profile.skills.length ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Skills</Text>
            {profile.skills.map((s, i) => (
              <Text key={i} style={styles.skillsRow}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>
                  {s.name ? `${s.name}: ` : ""}
                </Text>
                {s.keywords.join(", ")}
              </Text>
            ))}
          </View>
        ) : null}

        {profile.certificates.length ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Certifications</Text>
            {profile.certificates.map((c, i) => (
              <Text key={i} style={styles.skillsRow}>
                {c.name}
                {c.issuer ? ` — ${c.issuer}` : ""}
                {c.date ? ` (${c.date})` : ""}
              </Text>
            ))}
          </View>
        ) : null}

        {profile.publications.length ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Publications</Text>
            {profile.publications.map((p, i) => (
              <Text key={i} style={styles.skillsRow}>
                {p.name}
                {p.publisher ? ` — ${p.publisher}` : ""}
                {p.releaseDate ? ` (${p.releaseDate})` : ""}
              </Text>
            ))}
          </View>
        ) : null}

        {profile.awards.length ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Awards</Text>
            {profile.awards.map((a, i) => (
              <Text key={i} style={styles.skillsRow}>
                {a.title}
                {a.awarder ? ` — ${a.awarder}` : ""}
                {a.date ? ` (${a.date})` : ""}
              </Text>
            ))}
          </View>
        ) : null}

        {profile.languages.length ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Languages</Text>
            <Text style={styles.skillsRow}>
              {profile.languages
                .map((l) => (l.fluency ? `${l.language} (${l.fluency})` : l.language))
                .join(", ")}
            </Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

/** Pages in a react-pdf Blob. The generated PDF keeps the page tree in ASCII,
 *  so we can read `/Type /Pages … /Count N` without a PDF parser dependency. */
async function pageCountOf(blob: Blob): Promise<number> {
  const text = new TextDecoder("latin1").decode(await blob.arrayBuffer());
  const m = text.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
  if (m) return Number(m[1]);
  const pages = text.match(/\/Type\s*\/Page(?![s])/g);
  return pages ? pages.length : 1;
}

const MIN_SCALE = 0.72; // ~7.2pt body floor — below this it's unreadable
const MAX_SCALE = 1.22; // ~12pt body ceiling — above this it looks oversized

/**
 * Render the résumé at the LARGEST density that still fits within `pageTarget`
 * pages — i.e. fill the page like a human would: shrink when content overflows,
 * grow to close up dead space when it's short. Page count rises monotonically
 * with scale, so we binary-search the threshold.
 */
export async function renderFittedResumeBlob(
  profile: Profile,
  pageTarget: 1 | 2 = 1,
): Promise<{ blob: Blob; scale: number }> {
  const render = (s: number) => pdf(<ResumeDocument profile={profile} scale={s} />).toBlob();
  const fits = async (s: number) => (await pageCountOf(await render(s))) <= pageTarget;

  // Biggest allowed density already fits → use it (short résumé, fill by growing).
  if (await fits(MAX_SCALE)) {
    return { blob: await render(MAX_SCALE), scale: MAX_SCALE };
  }
  // Even the smallest density overflows → best effort at the floor.
  if (!(await fits(MIN_SCALE))) {
    return { blob: await render(MIN_SCALE), scale: MIN_SCALE };
  }
  // Threshold is somewhere in between — binary-search the largest scale that fits.
  let lo = MIN_SCALE;
  let hi = MAX_SCALE;
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    if (await fits(mid)) lo = mid;
    else hi = mid;
  }
  return { blob: await render(lo), scale: lo };
}

export default function ResumeDownloadButton({
  profile,
  pageTarget = 1,
  fileName = "resume.pdf",
  label = "Download PDF",
}: {
  profile: Profile;
  pageTarget?: 1 | 2;
  fileName?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn-primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { blob } = await renderFittedResumeBlob(profile, pageTarget);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Spinner /> : null}
      {busy ? "Fitting…" : label}
    </button>
  );
}
