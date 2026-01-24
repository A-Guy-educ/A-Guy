// scripts/deps-security-report.ts
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, ".ai-docs/reports");
const OUT_FILE = path.join(OUT_DIR, "deps-security-report.md");

const args = process.argv.slice(2);
const STRICT = args.includes("--strict");

// GitHub issue upsert integration (optional)
const UPSERT_ISSUE = args.includes("--upsert-issue");
const ISSUE_TITLE =
  getArgValue(args, "--issue-title") || "Dependency security findings (automated)";
const ISSUE_LABELS =
  getArgValue(args, "--issue-labels") || "automation,security,deps";
const ISSUE_DEDUPE_LABEL =
  getArgValue(args, "--issue-dedupe-label") || "deps-security";

function getArgValue(argv: string[], key: string): string | null {
  const i = argv.indexOf(key);
  if (i === -1) return null;
  const v = argv[i + 1];
  if (!v || v.startsWith("--")) return null;
  return v;
}

function sh(cmd: string) {
  return execSync(cmd, { cwd: REPO_ROOT, stdio: "pipe", encoding: "utf8" });
}

function safe(cmd: string) {
  try {
    return { ok: true as const, out: sh(cmd) };
  } catch (e: any) {
    // pnpm audit exits non-zero when vulnerabilities exist — we still want the output
    const out =
      (e?.stdout ? String(e.stdout) : "") +
      (e?.stderr ? "\n" + String(e.stderr) : "");
    return { ok: false as const, out };
  }
}

function nowIso() {
  return new Date().toISOString();
}

function writeReport(opts: {
  auditText: string;
  outdatedText: string;
  auditOk: boolean;
}) {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const lines: string[] = [];
  lines.push(`# Dependency Security Report`);
  lines.push(``);
  lines.push(`- Generated: **${nowIso()}**`);
  lines.push(`- Tooling: pnpm`);
  lines.push(
    `- Audit exit status: **${opts.auditOk ? "OK (0)" : "NON-ZERO (vulns or warnings)"}**`
  );
  lines.push(``);

  lines.push(`## Summary`);
  lines.push(``);
  lines.push(
    `This report is generated daily. If audit is non-zero, review the findings and decide whether to:`
  );
  lines.push(`- patch via safe updates (preferred), or`);
  lines.push(`- accept risk with justification, or`);
  lines.push(`- schedule a dependency upgrade task.`);
  lines.push(``);

  lines.push(`## pnpm audit`);
  lines.push(``);
  lines.push("```");
  lines.push(opts.auditText.trim() || "(no output)");
  lines.push("```");
  lines.push(``);

  lines.push(`## pnpm outdated (informational)`);
  lines.push(``);
  lines.push("```");
  lines.push(opts.outdatedText.trim() || "(no output)");
  lines.push("```");

  fs.writeFileSync(OUT_FILE, lines.join("\n"), "utf8");
}

function deleteReportIfExists() {
  try {
    if (fs.existsSync(OUT_FILE)) fs.unlinkSync(OUT_FILE);
  } catch {
    // ignore
  }
}

function upsertIssue(reportBody: string) {
  // Requires scripts/github-issue-upsert.ts to exist
  // and workflow permissions: issues: write
  const cmd = [
    "pnpm",
    "tsx",
    "scripts/github-issue-upsert.ts",
    "--title",
    ISSUE_TITLE,
    "--body",
    reportBody,
    "--labels",
    ISSUE_LABELS,
    "--dedupe-label",
    ISSUE_DEDUPE_LABEL,
    "--mode",
    "upsert",
  ];

  // Use stdio: inherit so failures are visible in Actions logs
  execSync(cmd.join(" "), {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
    },
  });
}

function main() {
  const audit = safe("pnpm audit");
  const outdated = safe("pnpm outdated");

  // Only write report + issue when audit is NON-OK (findings)
  if (audit.ok) {
    deleteReportIfExists();
    console.log("Dependency security: OK (no findings). No report generated.");
    process.exit(0);
  }

  writeReport({
    auditText: audit.out,
    outdatedText: outdated.out,
    auditOk: audit.ok,
  });

  const reportBody = fs.readFileSync(OUT_FILE, "utf8");

  console.log(`Wrote report: ${path.relative(REPO_ROOT, OUT_FILE)}`);

  if (UPSERT_ISSUE) {
    upsertIssue(reportBody);
  }

  // Strict mode: fail on findings (useful for manual runs)
  if (STRICT) process.exit(1);

  // Non-strict: succeed (scheduled report-only job)
  process.exit(0);
}

main();
