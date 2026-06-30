import { describe, expect, it } from "vitest";
import { extractJson } from "../src/ai/json";

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips ```json fences", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("strips bare ``` fences", () => {
    expect(extractJson('```\n[1,2,3]\n```')).toEqual([1, 2, 3]);
  });

  it("recovers a JSON object from surrounding prose", () => {
    expect(extractJson('Here you go: {"score": 80} — done')).toEqual({ score: 80 });
  });

  it("recovers a JSON array from surrounding prose", () => {
    expect(extractJson("result: [1, 2] thanks")).toEqual([1, 2]);
  });

  it("throws on empty input", () => {
    expect(() => extractJson("   ")).toThrow(/empty/i);
  });

  it("throws on unrecoverable text", () => {
    expect(() => extractJson("not json at all")).toThrow(/not valid JSON/i);
  });
});
