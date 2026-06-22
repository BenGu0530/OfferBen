import type { Profile } from "../schema/profile";

export function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Recursively strip empty strings, empty arrays, null/undefined, and empty
 * objects so we send a smaller, cleaner payload to the LLM (fewer tokens,
 * less noise).
 */
export function compact<T>(value: T): T {
  if (Array.isArray(value)) {
    const arr = value
      .map((v) => compact(v))
      .filter((v) => !isEmpty(v));
    return arr as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const c = compact(v);
      if (!isEmpty(c)) out[k] = c;
    }
    return out as unknown as T;
  }
  return value;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

/** A compact, LLM-friendly view of a profile. */
export function compactProfile(profile: Profile): Partial<Profile> {
  return compact(profile);
}
