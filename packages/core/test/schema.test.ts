import { describe, expect, it } from "vitest";
import { ProfileSchema, emptyProfile } from "../src/schema/profile";

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
