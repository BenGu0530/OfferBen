import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Compile LaTeX with a local tectonic (brew install tectonic). Tectonic fetches
 * packages on first use and caches them, so the very first compile is slow and
 * every later one takes about a second.
 */

const CANDIDATES = [
  process.env.TECTONIC_PATH,
  "tectonic",
  "/opt/homebrew/bin/tectonic",
  "/usr/local/bin/tectonic",
].filter((x): x is string => Boolean(x));

export class TectonicMissingError extends Error {}

function run(bin: string, args: string[], cwd: string): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { cwd, timeout: 180_000, maxBuffer: 16 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err && (err as NodeJS.ErrnoException).code === "ENOENT") return reject(err);
        resolve({
          code: err ? ((err as { code?: number }).code ?? 1) : 0,
          stderr: String(stderr ?? ""),
        });
      },
    );
  });
}

export async function compileTex(tex: string): Promise<{ pdf: Buffer; pages: number }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "offerben-tex-"));
  try {
    await fs.writeFile(path.join(dir, "resume.tex"), tex, "utf8");
    let res: { code: number; stderr: string } | null = null;
    for (const bin of CANDIDATES) {
      try {
        res = await run(bin, ["-X", "compile", "--keep-logs", "resume.tex"], dir);
        break;
      } catch {
        /* not at this path; try the next */
      }
    }
    if (!res) throw new TectonicMissingError("tectonic is not installed (brew install tectonic).");

    const log = await fs.readFile(path.join(dir, "resume.log"), "utf8").catch(() => "");
    if (res.code !== 0) {
      const first =
        log.split("\n").find((l) => l.startsWith("! ")) ??
        res.stderr.split("\n").find((l) => /error/i.test(l));
      throw new Error(
        `LaTeX compile failed: ${(first ?? "unknown error").replace(/^!\s*/, "").slice(0, 300)}`,
      );
    }
    const pdf = await fs.readFile(path.join(dir, "resume.pdf"));
    const m = log.match(/Output written on .*?\((\d+) pages?/);
    return { pdf, pages: m ? Number(m[1]) : 1 };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
