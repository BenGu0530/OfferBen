import { describe, expect, it } from "vitest";
import { enforcePageBudget } from "../src/tailor/resume";
import type { TailoredResume } from "../src/schema/generation";

// The model can't measure rendered length, so it overshoots the page budget.
// enforcePageBudget is the deterministic guard that actually keeps a 1-pager
// to one page — these tests pin the counts it must enforce.

function work(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    name: `Company ${i}`,
    position: `Role ${i}`,
    highlights: ["a", "b", "c", "d", "e"],
  }));
}
function projects(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    name: `Project ${i}`,
    highlights: ["a", "b", "c", "d", "e"],
  }));
}

function make(counts: { work: number; projects: number; pubs: number; awards: number }): TailoredResume {
  return {
    profile: {
      work: work(counts.work),
      projects: projects(counts.projects),
      publications: Array.from({ length: counts.pubs }, (_, i) => ({ name: `Pub ${i}` })),
      awards: Array.from({ length: counts.awards }, (_, i) => ({ title: `Award ${i}` })),
    },
    dropped: [],
    emphasis: [],
    changeNotes: [],
  } as unknown as TailoredResume;
}

describe("enforcePageBudget", () => {
  it("caps a 1-page resume to 3 work / 2 projects / 3 bullets each", () => {
    const out = enforcePageBudget(make({ work: 5, projects: 4, pubs: 6, awards: 6 }), 1);
    expect(out.profile.work).toHaveLength(3);
    expect(out.profile.projects).toHaveLength(2);
    expect(out.profile.work[0].highlights).toHaveLength(3);
    expect(out.profile.projects[0].highlights).toHaveLength(3);
    expect(out.profile.publications).toHaveLength(3);
    expect(out.profile.awards).toHaveLength(3);
  });

  it("records everything it trimmed in `dropped` with a reason", () => {
    const out = enforcePageBudget(make({ work: 5, projects: 4, pubs: 0, awards: 0 }), 1);
    // 2 extra work + 2 extra projects trimmed.
    expect(out.dropped).toHaveLength(4);
    expect(out.dropped.every((d) => /fit 1 page/.test(d.reason))).toBe(true);
    expect(out.dropped.filter((d) => d.kind === "work")).toHaveLength(2);
    expect(out.dropped.filter((d) => d.kind === "project")).toHaveLength(2);
  });

  it("is looser for a 2-page target and doesn't cap pubs/awards", () => {
    const out = enforcePageBudget(make({ work: 5, projects: 4, pubs: 6, awards: 6 }), 2);
    expect(out.profile.work).toHaveLength(5); // under the 6 cap
    expect(out.profile.projects).toHaveLength(4);
    expect(out.profile.work[0].highlights).toHaveLength(5);
    expect(out.profile.publications).toHaveLength(6); // untouched at 2 pages
    expect(out.profile.awards).toHaveLength(6);
    expect(out.dropped).toHaveLength(0);
  });
});
