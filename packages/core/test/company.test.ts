import { describe, expect, it } from "vitest";
import {
  briefIsUseful,
  candidateHosts,
  contentScore,
  htmlToText,
} from "../src/company/research";
import { CompanyBriefSchema } from "../src/schema/company";

const hosts = (name: string, jobUrl?: string) => candidateHosts(name, jobUrl).map((c) => c.host);

describe("candidateHosts", () => {
  it("drops legal suffixes", () => {
    expect(hosts("Nimo Technology Inc.")).toContain("nimotechnology.com");
    expect(hosts("Nimo Technology Inc.")).not.toContain("nimotechnologyinc.com");
  });

  it("treats a trailing 'AI' as the TLD and ranks it first", () => {
    const c = candidateHosts("Skild AI");
    expect(c.map((x) => x.host)).toContain("skild.ai");
    const brand = c.find((x) => x.host === "skild.ai");
    const joined = c.find((x) => x.host === "skildai.com");
    // skildai.com is a different company; the brand form must outrank it.
    expect(brand!.prior).toBeGreaterThan(joined!.prior);
  });

  it("ranks the leading word alone below the full name", () => {
    const c = candidateHosts("Figure AI");
    expect(c.find((x) => x.host === "figure.com")!.prior).toBeLessThan(
      c.find((x) => x.host === "figure.ai")!.prior,
    );
  });

  it("recovers the company slug from an ATS url and ranks it top", () => {
    const c = candidateHosts("Acme Technology Inc.", "https://boards.greenhouse.io/acmerobots/jobs/42");
    expect(c[0].host).toBe("acmerobots.com");
  });

  it("ignores a non-ATS job url", () => {
    expect(hosts("Acme", "https://acme.com/careers/1")).not.toContain("careers.com");
  });

  it("returns nothing for an empty name", () => {
    expect(hosts("  ")).toEqual([]);
  });
});

describe("contentScore", () => {
  const page = (s: string) => s.padEnd(400, " x");

  it("rejects a domain-parking page", () => {
    expect(contentScore(page("nimo.ai for sale. Buy this domain at Spaceship.com"), "Nimo")).toBe(-1);
  });

  it("rejects a page that never names the company", () => {
    expect(contentScore(page("Reliable HELOC lending for homeowners"), "Skild AI")).toBe(-1);
  });

  it("scores a verbatim full-name match above a scattered-token one", () => {
    const exact = contentScore(page("Skild AI builds general purpose robotic intelligence"), "Skild AI");
    const loose = contentScore(page("Skild is available for retail analytics"), "Skild AI");
    expect(exact).toBeGreaterThan(loose);
  });

  it("accepts a stealth one-pager with almost no text", () => {
    expect(contentScore("ReCAST Robotics | Stealth", "ReCAST Robotics")).toBeGreaterThan(0);
  });

  it("rewards overlap with the job ad's vocabulary", () => {
    const jd = `reinforcement learning diffusion policies manipulation teleoperation
      humanoid locomotion imitation grasping trajectory perception autonomy actuators`;
    const terms = jd.toLowerCase().match(/[a-z][a-z-]{5,}/g) || [];
    const robotics = contentScore(
      page("Skild AI: humanoid manipulation, grasping, locomotion, perception, autonomy, imitation"),
      "Skild AI",
      terms,
    );
    const unrelated = contentScore(page("Skild AI: market research surveys"), "Skild AI", terms);
    expect(robotics).toBeGreaterThan(unrelated);
  });
});

describe("htmlToText", () => {
  it("drops scripts, styles and tags", () => {
    const out = htmlToText(
      `<style>.a{color:red}</style><script>var x=1</script><h1>Acme</h1><p>We build&nbsp;robots &amp; tools.</p>`,
    );
    expect(out).toContain("Acme");
    expect(out).toContain("We build robots & tools.");
    expect(out).not.toContain("var x");
    expect(out).not.toContain("color:red");
  });
});

describe("briefIsUseful", () => {
  it("is false for an empty or missing brief", () => {
    expect(briefIsUseful(null)).toBe(false);
    expect(briefIsUseful(CompanyBriefSchema.parse({ name: "Acme" }))).toBe(false);
  });

  it("is true once there is something concrete to cite", () => {
    const b = CompanyBriefSchema.parse({
      name: "Acme",
      products: [{ name: "Foundry", what: "a robot work cell", forWho: "factories" }],
    });
    expect(briefIsUseful(b)).toBe(true);
  });
});
