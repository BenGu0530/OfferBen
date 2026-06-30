import { describe, expect, it } from "vitest";
import { reconstructAbstract } from "../src/people/research";

describe("reconstructAbstract", () => {
  it("rebuilds text from an inverted index in position order", () => {
    // OpenAlex format: word -> [positions]
    const inv = { Legged: [0], robots: [1], are: [2], hard: [3] };
    expect(reconstructAbstract(inv)).toBe("Legged robots are hard");
  });

  it("handles repeated words at multiple positions", () => {
    const inv = { the: [0, 2], cat: [1], hat: [3] };
    expect(reconstructAbstract(inv)).toBe("the cat the hat");
  });

  it("returns undefined for missing or empty input", () => {
    expect(reconstructAbstract(undefined)).toBeUndefined();
    expect(reconstructAbstract({})).toBeUndefined();
  });
});
