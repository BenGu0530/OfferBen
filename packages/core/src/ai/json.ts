/**
 * Best-effort extraction of a JSON value from an LLM text response.
 * Handles code fences and leading/trailing prose by falling back to the
 * outermost {...} or [...] span.
 */
export function extractJson(text: string): unknown {
  if (!text || !text.trim()) {
    throw new Error("AI returned an empty response.");
  }

  let t = text.trim();

  // Strip ```json ... ``` or ``` ... ``` fences.
  if (t.startsWith("```")) {
    t = t
      .replace(/^```(?:json|JSON)?\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  try {
    return JSON.parse(t);
  } catch {
    // fall through to span extraction
  }

  const start = firstIndex(t, ["{", "["]);
  const end = lastIndex(t, ["}", "]"]);
  if (start !== -1 && end !== -1 && end > start) {
    const span = t.slice(start, end + 1);
    try {
      return JSON.parse(span);
    } catch {
      // fall through
    }
  }

  throw new Error("AI response was not valid JSON.");
}

function firstIndex(s: string, chars: string[]): number {
  let min = -1;
  for (const c of chars) {
    const i = s.indexOf(c);
    if (i !== -1 && (min === -1 || i < min)) min = i;
  }
  return min;
}

function lastIndex(s: string, chars: string[]): number {
  let max = -1;
  for (const c of chars) {
    const i = s.lastIndexOf(c);
    if (i > max) max = i;
  }
  return max;
}
