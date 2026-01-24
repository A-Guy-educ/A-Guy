import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, ".ai-docs/reports");
const OUT_FILE = path.join(OUT_DIR, "repo-hygiene-report.md");

function nowIso() {
  return new Date().toISOString();
}

function safe(cmd: string) {
  try {
    const out = execSync(cmd, { cwd: REPO_ROOT, stdio: "pipe", encoding: "utf8" });
    return { ok: true as const, out };
  } catch (e: any) {
    const out =
      (e?.stdout ? String(e.stdout) : "") +
      (e?.stderr ? "\n" + String(e.stderr) : "");
    return { ok: false as const, out };
  }
}

function writeReport(knip: { ok: boolean; out: string }) {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const lines: string[] = [];
  lines.push(`# Repo Hygiene Report`);
  lines.push(``);
  lines.push(`- Generated: **${nowIso()}**`);
  lines.push(`- Tool: **knip** (report-only)`);
  lines.push(`- Exit status: **${knip.ok ? "OK (0)" : "NON-ZERO (findings or warnings)"}**`);
  lines.push(``);
  lines.push(`## Notes`);
  lines.push(`This job is informational and does not open a PR.`);
  lines.push(`Use it to schedule cleanup tasks (dead files/exports/deps).`);
  lines.push(``);
  lines.push(`## knip output`);
  lines.push(``);
  lines.push("```");
  lines.push(knip.out.trim() || "(no output)");
  lines.push("```");

  fs.writeFileSync(OUT_FILE, lines.join("\n"), "utf8");
}

function main() {
  // Run knip via dlx to avoid permanently adding a dependency if you don't want it.
  // If you prefer pinning, add "knip" as a devDependency and run "pnpm knip".
  const knip = safe("pnpm -s dlx knip");

  writeReport(knip);
  console.log(`Wrote report: ${path.relative(REPO_ROOT, OUT_FILE)}`);

  // IMPORTANT: never fail the workflow; it's a report job.
  process.exit(0);
}

main();
