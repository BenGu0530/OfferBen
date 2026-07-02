import { describe, expect, it } from "vitest";
import { ProfileSchema, emptyProfile } from "../src/schema/profile";
import { TailoredResumeSchema } from "../src/schema/generation";

describe("ProfileSchema", () => {
  it("is tolerant: parse({}) fills defaults and never throws", () => {
    const p = ProfileSchema.parse({});
    expect(p.basics.name).toBe("");
    expect(p.work).toEqual([]);
    expect(p.skills).toEqual([]);
  });

  it("defaults missing array fields inside nested objects", () => {
    const p = ProfileSchema.parse({ work: [{ name: "Lab", position: "RA" }] });
    expect(p.work[0].highlights).toEqual([]);
    expect(p.work[0].name).toBe("Lab");
  });

  it("emptyProfile() is a valid empty profile", () => {
    expect(emptyProfile().basics.profiles).toEqual([]);
  });
});

describe("TailoredResumeSchema", () => {
  it("defaults dropped/emphasis/changeNotes when absent", () => {
    const r = TailoredResumeSchema.parse({ profile: {} });
    expect(r.dropped).toEqual([]);
    expect(r.emphasis).toEqual([]);
  });

  it("keeps a dropped item with its reason", () => {
    const r = TailoredResumeSchema.parse({
      profile: {},
      dropped: [{ kind: "project", title: "Snake robot", reason: "unrelated to this backend role" }],
    });
    expect(r.dropped[0].title).toBe("Snake robot");
    expect(r.dropped[0].kind).toBe("project");
  });

  it("does NOT throw when the model drops a publication/award (kind outside work|project)", () => {
    // Regression: the model sometimes labels dropped items "publication"/"award";
    // that must not fail the whole parse.
    const r = TailoredResumeSchema.parse({
      profile: {},
      dropped: [
        { kind: "publication", title: "IROS 2026 paper", reason: "space" },
        { kind: "award", title: "SURF", reason: "space" },
      ],
    });
    expect(r.dropped).toHaveLength(2);
    expect(r.dropped[0].kind).toBe("publication");
  });

  it("coerces a truly unknown kind to 'other' instead of throwing", () => {
    const r = TailoredResumeSchema.parse({
      profile: {},
      dropped: [{ kind: "hobbies", title: "Chess", reason: "irrelevant" }],
    });
    expect(r.dropped[0].kind).toBe("other");
  });
});
