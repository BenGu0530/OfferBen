import { describe, expect, it } from "vitest";
import { clamp, compact } from "../src/util/object";

describe("clamp", () => {
  it("bounds within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
  it("returns min for NaN", () => {
    expect(clamp(Number.NaN, 0, 100)).toBe(0);
  });
});

describe("compact", () => {
  it("strips empty strings, arrays, nulls, and empty objects", () => {
    expect(
      compact({ a: "x", b: "", c: [], d: null, e: { f: "" }, g: ["", "y"] }),
    ).toEqual({ a: "x", g: ["y"] });
  });

  it("recurses into nested structures", () => {
    expect(compact({ work: [{ name: "Lab", url: "", hl: [] }] })).toEqual({
      work: [{ name: "Lab" }],
    });
  });

  it("keeps falsy-but-meaningful values like 0 and false", () => {
    expect(compact({ score: 0, ok: false })).toEqual({ score: 0, ok: false });
  });
});
