import { describe, expect, it } from "vitest";
import {
  applyProposal,
  libraryToProfile,
  normalizeFactText,
  splitEventVenue,
} from "../src/library/library";
import { ProposalSchema } from "../src/schema/library";
import { applySectionSet, autoBold, defaultDoc, ResumeDocSchema } from "../src/resume/doc";
import { renderResumeTex, richText, texEscape } from "../src/resume/latex";
import {
  boldJobKeywords,
  limitBold,
  numbersIn,
  trimStep,
  validateResumeDoc,
} from "../src/resume/validate";
import { sampleLibrary } from "./fixtures/library";

describe("LaTeX text handling", () => {
  it("escapes specials in one pass (no double escaping)", () => {
    expect(texEscape("R&D 50% #1 a_b {x} \\")).toBe(
      "R\\&D 50\\% \\#1 a\\_b \\{x\\} \\textbackslash{}",
    );
  });
  it("maps Unicode science symbols so pdfTeX compiles them", () => {
    expect(richText("1.8× at μ = 0.12, 6° slope")).toBe(
      "1.8$\\times$ at $\\mu$ = 0.12, 6\\textdegree{} slope",
    );
  });
  it("passes real math through, but treats dollar amounts as text", () => {
    expect(richText("speed $\\propto L^{0.5}$")).toBe("speed $\\propto L^{0.5}$");
    expect(richText("$50k and $20k")).toBe("\\$50k and \\$20k");
  });
  it("turns $6^{\\circ}$ into an inline text degree (clean PDF text extraction)", () => {
    expect(richText("climb $6^{\\circ}$ slopes")).toBe("climb 6\\textdegree{} slopes");
  });
  it("turns a bare caret exponent into a superscript, keeps lone carets literal", () => {
    expect(richText("speed ∝ L^0.5 and torque ∝ mL")).toBe(
      "speed $\\propto$ L\\textsuperscript{0.5} and torque $\\propto$ mL",
    );
    expect(richText("x^{2} but ^ alone")).toBe(
      "x\\textsuperscript{2} but \\textasciicircum{} alone",
    );
  });
  it("renders **bold** and escapes inside it", () => {
    expect(richText("a **96% success** b")).toBe("a \\textbf{96\\% success} b");
  });
});

describe("bold + number guards", () => {
  it("keeps only the first bold span", () => {
    expect(limitBold("**a** and **b** and **c**")).toBe("**a** and b and c");
  });
  it("extracts asserted numbers", () => {
    expect(numbersIn("1.8× faster, 44% lower, 2,500 runs, 007")).toEqual([
      "1.8",
      "44",
      "2500",
      "7",
    ]);
  });
  it("auto-bolds the first result-like token only", () => {
    expect(autoBold("was 1.8× faster with 44% lower cost")).toBe(
      "was **1.8×** faster with 44% lower cost",
    );
    expect(autoBold("no metric here")).toBe("no metric here");
  });
});

describe("validateResumeDoc", () => {
  const lib = sampleLibrary();
  it("drops fabricated entries/facts and reverts bullets with unsupported numbers", () => {
    const doc = ResumeDocSchema.parse({
      archetype: "industry",
      sections: [
        {
          key: "experience",
          items: [
            {
              entryId: "pos-intern",
              bullets: [
                { text: "Replaced a QP/IK controller with **PPO**", factIds: ["f-i1"] },
                { text: "Validated on 5 terrains", factIds: ["f-i2"] }, // 5 is not in the fact
                { text: "Invented thing", factIds: ["nope"] },
              ],
            },
            { entryId: "ghost", bullets: [] },
          ],
        },
      ],
      skills: [{ name: "Tools", keywords: ["MuJoCo", "Kubernetes"] }],
    });
    const { doc: out, warnings } = validateResumeDoc(doc, lib);
    const bullets = out.sections[0].items[0].bullets;
    expect(out.sections[0].items).toHaveLength(1);
    expect(bullets).toHaveLength(2);
    expect(bullets[1].text).toContain("3 outdoor terrains"); // reverted to the source fact
    expect(out.skills[0].keywords).toEqual(["MuJoCo"]);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
  it("bolds the first metric when the model marked nothing, and fixes 1.8x -> 1.8×", () => {
    const doc = ResumeDocSchema.parse({
      sections: [
        {
          key: "research",
          items: [
            {
              entryId: "pos-lab",
              children: [
                {
                  entryId: "prj-biped",
                  bullets: [{ text: "Gait was 1.8x faster with 44% lower CoT", factIds: ["f-b2"] }],
                },
              ],
            },
          ],
        },
        { key: "skills", items: [{ entryId: "" }] },
      ],
    });
    const { doc: out, warnings } = validateResumeDoc(doc, lib);
    expect(out.sections[0].items[0].children[0].bullets[0].text).toBe(
      "Gait was **1.8×** faster with 44% lower CoT",
    );
    expect(warnings).toEqual([]); // skills-section noise is ignored silently
  });
  it("rejects a child that doesn't belong to its parent", () => {
    const doc = ResumeDocSchema.parse({
      sections: [
        { key: "research", items: [{ entryId: "pos-lab", children: [{ entryId: "prj-quad" }] }] },
      ],
    });
    expect(validateResumeDoc(doc, lib).doc.sections[0].items[0].children).toHaveLength(0);
  });
});

describe("sections", () => {
  const lib = sampleLibrary();
  it("inlines publications + demos under their project when they have no section", () => {
    const tex = renderResumeTex(lib, defaultDoc(lib));
    expect(tex).toContain("\\textbf{Publications (Co-First Author):}");
    expect(tex).toContain("workshop papers at IROS 2026");
    expect(tex).toContain(
      "live hardware demos at NFL Draft Tech Day and NSF FRR, all in Pittsburgh, 2026",
    );
    expect(tex).not.toContain("PUBLIC DEMOS");
  });
  it("moves demos into their own section when it is switched on (entertainment roles)", () => {
    const base = { ...defaultDoc(lib), archetype: "entertainment" as const };
    const keys = [...base.sections.map((s) => s.key), "demos" as const];
    const doc = applySectionSet(base, lib, keys);
    expect(doc.sections.map((s) => s.key)).toEqual([
      "education",
      "experience",
      "demos",
      "research",
      "projects",
      "skills",
    ]);
    const tex = renderResumeTex(lib, doc);
    expect(tex).toContain("\\section*{PUBLIC DEMOS}");
    expect(tex).toContain(
      "\\textbf{NFL Draft Tech Day and NSF FRR}, Pittsburgh, 2026: live hardware demos of the Penguin-Inspired Biped.",
    );
    expect(tex).not.toContain("live hardware demos at");
    expect(tex).toContain("\\textbf{Publications (Co-First Author):}"); // publications still inline
  });
  it("renders a two-level research block and same-line skill groups", () => {
    const tex = renderResumeTex(lib, defaultDoc(lib));
    expect(tex).toContain(
      "\\textbf{Student Researcher}, \\textit{Legged Lab, Example University (PI: Prof. Jane Roe)}",
    );
    expect(tex).toContain(
      "\\textbf{Languages:} Python, C++ \\quad \\textbf{Embedded:} CAN, Arduino",
    );
    expect(tex).not.toMatch(/undefined|null/);
  });
});

describe("trimStep", () => {
  it("shaves bullets before dropping items, and eventually stops", () => {
    const lib = sampleLibrary();
    let doc = defaultDoc(lib);
    const first = trimStep(doc)!;
    expect(first.note).toMatch(/bullet/);
    let steps = 0;
    while (steps < 50) {
      const t = trimStep(doc);
      if (!t) break;
      doc = t.doc;
      steps++;
    }
    expect(steps).toBeLessThan(50);
    expect(doc.sections.find((s) => s.key === "education")!.items).toHaveLength(2);
  });
});

describe("ingestion cleanups", () => {
  it("splits 'Event, City, Year' crammed into a demo's venue", () => {
    expect(
      splitEventVenue({
        venue: "NSF Foundational Research in Robotics (FRR), Pittsburgh, 2026",
        location: "",
        date: "",
      }),
    ).toEqual({
      venue: "NSF Foundational Research in Robotics (FRR)",
      location: "Pittsburgh",
      date: "2026",
    });
    expect(splitEventVenue({ venue: "NCUR 2025", location: "", date: "" }).venue).toBe("NCUR 2025");
    expect(splitEventVenue({ venue: "Expo, 2024", location: "", date: "" })).toMatchObject({
      venue: "Expo",
      date: "2024",
    });
  });
  it("turns LaTeX number ranges into en dashes", () => {
    expect(normalizeFactText(" across 0.02--1.2 m legs ")).toBe("across 0.02–1.2 m legs");
  });
});

describe("applyProposal", () => {
  it("adds a lab + child project via temp ids, merges a duplicate, attaches a photo with the user's note", () => {
    const lib = sampleLibrary();
    const proposal = ProposalSchema.parse({
      ops: [
        {
          op: "add",
          entry: {
            tempId: "new-1",
            kind: "position",
            section: "research",
            title: "Visiting Researcher",
            org: "Other Lab",
          },
        },
        {
          op: "add",
          entry: {
            tempId: "new-2",
            kind: "project",
            parentId: "new-1",
            title: "Hand Reorientation",
            facts: ["Trained a LEAP Hand policy."],
          },
        },
        {
          op: "add",
          entry: {
            kind: "project",
            title: "sim to real quadrotor landing",
            facts: ["Logged 200 hardware flights."],
          },
        },
        { op: "attachMedia", entryId: "prj-biped", caption: "Biped on a slope rig" },
        { op: "add", entry: { tempId: "new-3", kind: "project", title: "Rejected one" } },
      ],
    });
    const { library: out } = applyProposal(lib, proposal, {
      accept: [0, 1, 2, 3],
      fileHash: "a".repeat(64),
      fileMime: "image/jpeg",
      notes: { 3: "I designed the crank-slider leg." },
    });
    const lab = out.entries.find((e) => e.title === "Visiting Researcher")!;
    const hand = out.entries.find((e) => e.title === "Hand Reorientation")!;
    expect(hand.parentId).toBe(lab.id);
    expect(out.entries.filter((e) => /quadrotor/i.test(e.title))).toHaveLength(1);
    expect(out.entries.find((e) => e.id === "prj-quad")!.facts.map((f) => f.text)).toContain(
      "Logged 200 hardware flights.",
    );
    const biped = out.entries.find((e) => e.id === "prj-biped")!;
    expect(biped.media[0]).toMatchObject({
      caption: "I designed the crank-slider leg.",
      mime: "image/jpeg",
    });
    expect(biped.facts.map((f) => f.text)).toContain("I designed the crank-slider leg.");
    expect(out.entries.some((e) => e.title === "Rejected one")).toBe(false);
    expect(lib.entries).toHaveLength(sampleLibrary().entries.length); // input untouched
  });
  it("projects onto the Profile shape used by scoring and letters", () => {
    const p = libraryToProfile(sampleLibrary());
    expect(p.basics.email).toBe("alex@example.edu");
    expect(p.work.map((w) => w.position)).toEqual([
      "Robotics Engineer Intern",
      "Student Researcher",
    ]);
    expect(p.projects.find((x) => x.name === "Penguin-Inspired Biped")!.highlights).toContain(
      "Live demo at NFL Draft Tech Day, 2026",
    );
    expect(p.publications).toHaveLength(1);
  });
});

describe("boldJobKeywords", () => {
  it("bolds the first skill the job asks for, only in bullets without bold", () => {
    const lib = sampleLibrary();
    const doc = ResumeDocSchema.parse({
      sections: [
        {
          key: "experience",
          items: [
            {
              entryId: "pos-intern",
              bullets: [
                {
                  text: "Built sim pipelines in MuJoCo and trained in Isaac Lab",
                  factIds: ["f-i1"],
                },
                { text: "Already has **bold** here with MuJoCo", factIds: ["f-i2"] },
              ],
            },
          ],
        },
      ],
    });
    const job = "We use Isaac Lab daily. MuJoCo is a plus.";
    const out = boldJobKeywords(doc, lib, job).sections[0].items[0].bullets;
    expect(out[0].text).toBe("Built sim pipelines in MuJoCo and trained in **Isaac Lab**");
    expect(out[1].text).toBe("Already has **bold** here with MuJoCo");
  });
});

describe("publications section", () => {
  it("lists titled papers and folds untitled workshop papers into one line naming the project", () => {
    const lib = sampleLibrary();
    const doc = applySectionSet({ ...defaultDoc(lib), archetype: "research" }, lib, [
      "education",
      "research",
      "publications",
      "skills",
    ]);
    const tex = renderResumeTex(lib, doc);
    expect(tex).toContain("\\section*{PUBLICATIONS}");
    expect(tex).toContain("Workshop paper at IROS 2026, on the Penguin-Inspired Biped.");
    expect(tex).not.toContain("\\textbf{Publications (Co-First Author):}"); // not duplicated inline
  });
});
