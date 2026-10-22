/**
 * Shared retry/backoff for AI providers. Used by every provider so transient
 * capacity errors and the occasional truncated-JSON response are handled in one
 * place, identically.
 */

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * True for errors worth retrying: transient capacity errors (overloaded /
 * rate-limited), gateway blips (502/504), AND unparseable/empty JSON (a fresh
 * attempt usually returns clean JSON). NOT true for daily-quota exhaustion — see
 * `isDailyQuota`, which callers use to skip retrying a wall that won't clear.
 *
 * If the error carries an explicit numeric `status` (as openai.ts now attaches),
 * we trust that over regex-matching the message body — response prose sometimes
 * contains stray numbers like "500" that would otherwise look transient.
 */
export function isTransient(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const s = String((err as { message?: string })?.message ?? err);
  const statusIsTransient =
    typeof status === "number"
      ? [429, 500, 502, 503, 504].includes(status)
      : /\b(429|500|502|503|504)\b/.test(s);
  return (
    statusIsTransient ||
    /UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED/i.test(s) ||
    /not valid JSON|empty response/i.test(s)
  );
}

/**
 * True for DAILY quota exhaustion (as opposed to a per-minute rate limit). This
 * won't clear within any retry window — the free tier resets at midnight Pacific
 * — so retrying just burns time and hits the same wall. Callers skip retry here.
 */
export function isDailyQuota(err: unknown): boolean {
  const s = String((err as { message?: string })?.message ?? err);
  return /per day|daily limit|daily|quota metric.*per.?day|quota.*exceeded.*day/i.test(s);
}

/** True for schema/validation failures (ZodError, wrong type) — an LLM re-roll usually fixes them. */
function isSchemaError(err: unknown): boolean {
  if ((err as { name?: string })?.name === "ZodError") return true;
  const s = String((err as { message?: string })?.message ?? err);
  return /invalid.*json|zoderror|expected .* received/i.test(s);
}

/** Retry a transient-failing call with exponential backoff (0.5s, 1s, 2s …). */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Daily-quota exhaustion won't recover on retry — fail out immediately.
      if (isDailyQuota(err)) break;
      // Schema/validation failures are retryable: a fresh LLM roll usually
      // returns valid types (e.g. a real string where it sent null).
      const retryable = isTransient(err) || isSchemaError(err);
      if (!retryable || i === tries - 1) break;
      await sleep(500 * 2 ** i);
    }
  }
  const s = String((lastErr as { message?: string })?.message ?? lastErr);
  if (
    /\b(429|500|502|503|504)\b/.test(s) ||
    /UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED|per day|daily/i.test(s)
  ) {
    throw new Error("The AI model is busy or out of quota right now. Try again in a moment.");
  }
  if (/not valid JSON|empty response/i.test(s) || isSchemaError(lastErr)) {
    throw new Error(
      "The AI couldn't produce a clean result for this page. Try again, or use a cleaner job posting.",
    );
  }
  throw lastErr;
}
