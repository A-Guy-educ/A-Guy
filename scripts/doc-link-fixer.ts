// scripts/doc-link-fixer.ts
import fs from "node:fs";
import path from "node:path";

type Broken = { file: string; link: string; resolved: string };

const REPO_ROOT = process.cwd();
const REPORT_PATH = path.join(REPO_ROOT, ".ai-docs/reports/doc-link-report.md");

const args = process.argv.slice(2);
const STRICT = args.includes("--strict");

// Conservative, safe rewrites (extend as needed)
const SAFE_REWRITES: Array<[RegExp, string]> = [
  [/^docs\/ai\/schemas\//, ".ai-docs/schemas/"],
  [/^docs\/ai\/indexes\//, ".ai-docs/indexes/"],
  [/^docs\/ai\/quick-reference\//, ".ai-docs/quick-reference/"],
];

const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

function isExternal(href: string) {
  return (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

function normalizeHref(raw: string) {
  let href = raw.trim();
  if (href.startsWith("<") && href.endsWith(">")) href = href.slice(1, -1).trim();
  href = href.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  return href;
}

function splitAnchor(href: string) {
  const idx = href.indexOf("#");
  if (idx === -1) return { p: href, anchor: "" };
  return { p: href.slice(0, idx), anchor: href.slice(idx + 1) };
}

function applySafeRewrites(href: string) {
  if (href.startsWith("#")) return href;

  const { p, anchor } = splitAnchor(href);
  let newPath = p.replace(/^\.\//, "");

  for (const [re, repl] of SAFE_REWRITES) {
    newPath = newPath.replace(re, repl);
  }

  return anchor ? `${newPath}#${anchor}` : newPath;
}

function resolveTarget(fromFile: string, href: string) {
  const { p } = splitAnchor(href);
  if (!p || p.startsWith("#")) return null;

  if (p.startsWith("/")) {
    // repo-root relative
    return path.join(REPO_ROOT, p.slice(1));
  }

  // file-relative
  return path.resolve(path.dirname(fromFile), p);
}

function fileExists(p: string) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function statIsFile(p: string) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function statIsDir(p: string) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function existsAsMarkdownOrDir(resolved: string) {
  // exact file
  if (fileExists(resolved) && statIsFile(resolved)) return resolved;

  // add .md if missing
  if (!path.extname(resolved) && fileExists(resolved + ".md") && statIsFile(resolved + ".md")) {
    return resolved + ".md";
  }

  // directory -> README.md / index.md
  if (fileExists(resolved) && statIsDir(resolved)) {
    const readme = path.join(resolved, "README.md");
    const index = path.join(resolved, "index.md");
    if (fileExists(readme) && statIsFile(readme)) return readme;
    if (fileExists(index) && statIsFile(index)) return index;
  }

  return null;
}

function toRelativeHref(fromFile: string, targetAbs: string, originalHref: string) {
  const { anchor } = splitAnchor(originalHref);
  let rel = path
    .relative(path.dirname(fromFile), targetAbs)
    .replaceAll(path.sep, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return anchor ? `${rel}#${anchor}` : rel;
}

function getAllMarkdownFiles(dir: string) {
  const out: string[] = [];
  const stack = [dir];

  while (stack.length) {
    const cur = stack.pop()!;
    const entries = fs.readdirSync(cur, { withFileTypes: true });

    for (const e of entries) {
      if (e.isDirectory()) {
        if (["node_modules", ".git", ".next", "dist", "build", "coverage"].includes(e.name)) continue;
        stack.push(path.join(cur, e.name));
        continue;
      }
      if (e.isFile() && e.name.endsWith(".md")) out.push(path.join(cur, e.name));
    }
  }

  return out;
}

function ensureReportDir() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
}

function deleteReportIfExists() {
  try {
    if (fs.existsSync(REPORT_PATH)) fs.unlinkSync(REPORT_PATH);
  } catch {
    // ignore
  }
}

function writeFailureReport(broken: Broken[]) {
  ensureReportDir();

  // Minimal "failure-only" report
  const lines: string[] = [];
  lines.push(`# Doc Link Fixer - Failure Report`);
  lines.push(``);
  lines.push(`Broken internal links remaining: **${broken.length}**`);
  lines.push(``);

  // Top offenders by source file (first 20)
  const byFile = new Map<string, number>();
  for (const b of broken) byFile.set(b.file, (byFile.get(b.file) ?? 0) + 1);
  const topFiles = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

  lines.push(`## Top source files`);
  lines.push(``);
  for (const [f, n] of topFiles) lines.push(`- ${f}: ${n}`);
  lines.push(``);

  lines.push(`## Broken links (first 200)`);
  lines.push(``);
  for (const b of broken.slice(0, 200)) {
    lines.push(`- **${b.file}**`);
    lines.push(`  - link: \`${b.link}\``);
    lines.push(`  - resolved: \`${b.resolved}\``);
  }
  if (broken.length > 200) {
    lines.push(``);
    lines.push(`(truncated: showing first 200)`);
  }

  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf8");
}

function scanAndMaybeFix({ applyFixes }: { applyFixes: boolean }) {
  const mdFiles = getAllMarkdownFiles(REPO_ROOT);

  let changedFiles = 0;
  const broken: Broken[] = [];

  for (const file of mdFiles) {
    const original = fs.readFileSync(file, "utf8");
    let updated = original;
    let touched = false;

    updated = updated.replace(MD_LINK_RE, (full, text, hrefRaw) => {
      const href0 = normalizeHref(hrefRaw);
      if (isExternal(href0)) return full;

      // Keep anchors-only untouched
      if (href0.startsWith("#")) return `[${text}](${href0})`;

      // Safe path rewrites
      const href1 = applySafeRewrites(href0);

      const target = resolveTarget(file, href1);
      if (!target) return `[${text}](${href1})`;

      const existing = existsAsMarkdownOrDir(target);
      if (existing) {
        // Canonicalize to relative href (adds .md, README, etc.)
        const newHref = toRelativeHref(file, existing, href1);
        if (applyFixes && newHref !== href1) {
          touched = true;
          return `[${text}](${newHref})`;
        }
        return `[${text}](${href1})`;
      }

      // Still broken
      broken.push({
        file: path.relative(REPO_ROOT, file),
        link: href1,
        resolved: path.relative(REPO_ROOT, target),
      });

      return `[${text}](${href1})`;
    });

    if (applyFixes && touched && updated !== original) {
      fs.writeFileSync(file, updated, "utf8");
      changedFiles++;
    }
  }

  return { changedFiles, broken };
}

function main() {
  // PASS 1: try to fix what is safe
  const pass1 = scanAndMaybeFix({ applyFixes: true });

  // PASS 2: rescan after fixes, report only if still broken
  const pass2 = scanAndMaybeFix({ applyFixes: false });

  if (pass2.broken.length === 0) {
    deleteReportIfExists();
    console.log(`Doc link fixer: OK (changed files: ${pass1.changedFiles})`);
    process.exit(0);
  }

  // Failure: write report (failure-only)
  writeFailureReport(pass2.broken);
  console.error(
    `Broken links remaining: ${pass2.broken.length}. Report: ${path.relative(REPO_ROOT, REPORT_PATH)}.`
  );

  // Strict mode: fail; otherwise succeed (useful for scheduled runs)
  if (STRICT) process.exit(1);
  process.exit(0);
}

main();
