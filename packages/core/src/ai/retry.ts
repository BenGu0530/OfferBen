/**
 * Shared retry/backoff for AI providers. Used by every provider so transient
 * capacity errors and the occasional truncated-JSON response are handled in one
 * place, identically.
 */

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * True for errors worth retrying: transient capacity errors (overloaded /
 * rate-limited) AND unparseable/empty JSON (a fresh attempt usually returns
 * clean JSON). NOT true for daily-quota exhaustion-style 429s — see throwClean.
 */
export function isTransient(err: unknown): boolean {
  const s = String((err as { message?: string })?.message ?? err);
  return (
    /\b(429|500|503)\b/.test(s) ||
    /UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED/i.test(s) ||
    /not valid JSON|empty response/i.test(s)
  );
}

/** Retry a transient-failing call with exponential backoff (0.5s, 1s, 2s …). */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || i === tries - 1) break;
      await sleep(500 * 2 ** i);
    }
  }
  const s = String((lastErr as { message?: string })?.message ?? lastErr);
  if (/\b(429|503)\b/.test(s) || /UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED/i.test(s)) {
    throw new Error("The AI model is busy or out of quota right now. Try again in a moment.");
  }
  if (/not valid JSON|empty response/i.test(s)) {
    throw new Error(
      "The AI couldn't produce a clean result for this page. Try again, or use a cleaner job posting.",
    );
  }
  throw lastErr;
}
