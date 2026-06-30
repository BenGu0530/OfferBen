import { describe, expect, it } from "vitest";
import { isTransient, withRetry } from "../src/ai/retry";

describe("isTransient", () => {
  it("is true for capacity / rate-limit errors", () => {
    expect(isTransient(new Error("503 UNAVAILABLE"))).toBe(true);
    expect(isTransient(new Error("429 RESOURCE_EXHAUSTED"))).toBe(true);
    expect(isTransient(new Error("model is experiencing high demand"))).toBe(true);
  });

  it("is true for bad/empty JSON (worth a fresh attempt)", () => {
    expect(isTransient(new Error("AI response was not valid JSON."))).toBe(true);
    expect(isTransient(new Error("AI returned an empty response."))).toBe(true);
  });

  it("is false for ordinary errors", () => {
    expect(isTransient(new Error("400 bad request"))).toBe(false);
    expect(isTransient(new Error("nope"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns on first success without retrying", async () => {
    let calls = 0;
    const out = await withRetry(async () => {
      calls++;
      return "ok";
    });
    expect(out).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries transient failures then succeeds", async () => {
    let calls = 0;
    const out = await withRetry(async () => {
      calls++;
      if (calls < 2) throw new Error("503 UNAVAILABLE");
      return "recovered";
    });
    expect(out).toBe("recovered");
    expect(calls).toBe(2);
  });

  it("does not retry non-transient errors", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new Error("400 bad request");
      }),
    ).rejects.toThrow(/bad request/);
    expect(calls).toBe(1);
  });

  it("gives a clean message after exhausting transient retries", async () => {
    await expect(
      withRetry(async () => {
        throw new Error("503 UNAVAILABLE");
      }, 2),
    ).rejects.toThrow(/busy or out of quota/i);
  });
});
