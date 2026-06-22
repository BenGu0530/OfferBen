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
const styles = StyleSheet.create({
  page: {
    paddingVertical: 34,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
    lineHeight: 1.4,
  },
  name: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  label: { fontSize: 11, color: "#444", marginTop: 2 },
  contact: { fontSize: 9, color: "#555", marginTop: 4 },
  summary: { marginTop: 8, fontSize: 10, color: "#222" },
  section: { marginTop: 14 },
  h2: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    paddingBottom: 2,
    marginBottom: 6,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  itemSub: { fontSize: 10, color: "#333" },
  itemMeta: { fontSize: 9, color: "#666" },
  bullet: { flexDirection: "row", marginTop: 2 },
  bulletDot: { width: 10, fontSize: 10 },
  bulletText: { flex: 1, fontSize: 10 },
  skillsRow: { fontSize: 10, marginTop: 2 },
  itemBlock: { marginBottom: 8 },
});

function Bullets({ items }: { items: string[] }) {
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

export function ResumeDocument({ profile }: { profile: Profile }) {
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
                <Bullets items={w.highlights} />
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
                <Bullets items={p.highlights} />
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

export default function ResumeDownloadButton({
  profile,
  fileName = "resume.pdf",
  label = "Download PDF",
}: {
  profile: Profile;
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
          const blob = await pdf(<ResumeDocument profile={profile} />).toBlob();
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
      {busy ? "Building…" : label}
    </button>
  );
}
