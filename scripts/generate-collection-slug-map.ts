import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const COLLECTIONS_ROOT = path.join(REPO_ROOT, "src", "server", "payload", "collections");
const OUT_DIR = path.join(REPO_ROOT, ".ai-docs", "indexes");
const OUT_FILE = path.join(OUT_DIR, "collection-slug-map.json");

type Entry = {
  slug: string;
  filePath: string;
  auth: boolean | null;
  versions: boolean | null;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeSlashes(p: string) {
  return p.replaceAll(path.sep, "/");
}

function isDir(p: string) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readText(p: string) {
  return fs.readFileSync(p, "utf8");
}

function findCollectionFiles(dirAbs: string, out: string[]) {
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  for (const ent of entries) {
    const abs = path.join(dirAbs, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules") continue;
      findCollectionFiles(abs, out);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!/\.(ts|tsx|js|jsx)$/.test(ent.name)) continue;

    // Heuristic: collection config files usually export CollectionConfig and contain "slug:"
    // We'll include any file with "slug:" and "CollectionConfig" tokens.
    const content = readText(abs);
    if (!content.includes("slug")) continue;
    if (!content.includes("CollectionConfig")) continue;

    out.push(abs);
  }
}

function extractSlug(content: string): string | null {
  // slug: 'users' OR slug: "users"
  const m = content.match(/slug\s*:\s*['"]([^'"]+)['"]/);
  return m?.[1] ?? null;
}

function detectAuth(content: string): boolean | null {
  // auth: true/false (top-level)
  const m = content.match(/\bauth\s*:\s*(true|false)\b/);
  return m ? m[1] === "true" : null;
}

function detectVersions(content: string): boolean | null {
  // versions: true OR versions: { ... }
  const mBool = content.match(/\bversions\s*:\s*(true|false)\b/);
  if (mBool) return mBool[1] === "true";
  const mObj = content.match(/\bversions\s*:\s*\{/);
  if (mObj) return true;
  return null;
}

function stableSort(entries: Entry[]) {
  entries.sort((a, b) => a.slug.localeCompare(b.slug));
}

function main() {
  if (!isDir(COLLECTIONS_ROOT)) {
    console.error(`Missing collections root: ${COLLECTIONS_ROOT}`);
    process.exit(1);
  }

  const files: string[] = [];
  findCollectionFiles(COLLECTIONS_ROOT, files);

  const entries: Entry[] = [];
  for (const f of files) {
    const content = readText(f);
    const slug = extractSlug(content);
    if (!slug) continue;

    entries.push({
      slug,
      filePath: normalizeSlashes(path.relative(REPO_ROOT, f)),
      auth: detectAuth(content),
      versions: detectVersions(content),
    });
  }

  stableSort(entries);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const out = {
    collections: entries,
    metadata: {
      generatedAt: nowIso(),
      totalCollections: entries.length,
      sourceRoot: normalizeSlashes(path.relative(REPO_ROOT, COLLECTIONS_ROOT)),
    },
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`Wrote: ${normalizeSlashes(path.relative(REPO_ROOT, OUT_FILE))} (${entries.length} collections)`);
}

main();
