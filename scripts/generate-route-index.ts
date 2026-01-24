import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const APP_ROOT = path.join(REPO_ROOT, "src", "app");
const OUT_DIR = path.join(REPO_ROOT, ".ai-docs", "indexes");
const OUT_FILE = path.join(OUT_DIR, "route-index.json");

type Kind = "page" | "route" | "layout" | "loading" | "error" | "not-found";

type RouteEntry = {
  routePath: string;
  filePath: string;
  kind: Kind;
  segmentGroup: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function isDir(p: string) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function normalizeSlashes(p: string) {
  return p.replaceAll(path.sep, "/");
}

function stripGroupSegments(segments: string[]) {
  return segments.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
}

function stripSpecialSegments(segments: string[]) {
  // Next.js app router conventions
  return segments
    .filter((s) => !s.startsWith("@")) // parallel routes
    .filter((s) => !s.startsWith("_")) // private
    .filter((s) => s !== "src" && s !== "app");
}

function segmentToPathSegment(seg: string): string | null {
  // ignore group segments
  if (seg.startsWith("(") && seg.endsWith(")")) return null;
  // dynamic segments: [id] -> :id
  if (seg.startsWith("[") && seg.endsWith("]")) return `:${seg.slice(1, -1)}`;
  // catch-all: [...slug] -> :slug*
  if (seg.startsWith("[...") && seg.endsWith("]")) return `:${seg.slice(4, -1)}*`;
  // optional catch-all: [[...slug]] -> :slug?*
  if (seg.startsWith("[[...") && seg.endsWith("]]")) return `:${seg.slice(5, -2)}?*`;
  return seg;
}

function fileKindFromName(fileName: string): Kind | null {
  const base = fileName.replace(/\.(tsx|ts|jsx|js)$/, "");
  if (base === "page") return "page";
  if (base === "route") return "route";
  if (base === "layout") return "layout";
  if (base === "loading") return "loading";
  if (base === "error") return "error";
  if (base === "not-found") return "not-found";
  return null;
}

function findSegmentGroup(relParts: string[]): string | null {
  // First group encountered in path (e.g. (frontend), (payload))
  const g = relParts.find((p) => p.startsWith("(") && p.endsWith(")"));
  return g ?? null;
}

function buildRoutePath(fromDirRelToApp: string): string {
  const parts = stripSpecialSegments(fromDirRelToApp.split("/").filter(Boolean));
  const cleaned = stripGroupSegments(parts)
    .map((seg) => segmentToPathSegment(seg))
    .filter((x): x is string => Boolean(x));

  const joined = cleaned.join("/");
  // root route:
  return "/" + (joined ? joined : "");
}

function walk(dirAbs: string, routes: RouteEntry[]) {
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });

  for (const ent of entries) {
    const abs = path.join(dirAbs, ent.name);
    if (ent.isDirectory()) {
      // ignore node_modules-like dirs (just in case)
      if (ent.name === "node_modules") continue;
      walk(abs, routes);
      continue;
    }

    if (!ent.isFile()) continue;
    if (!/\.(ts|tsx|js|jsx)$/.test(ent.name)) continue;

    const kind = fileKindFromName(ent.name);
    if (!kind) continue;

    const relToRepo = normalizeSlashes(path.relative(REPO_ROOT, abs));
    const relDirToApp = normalizeSlashes(path.relative(APP_ROOT, path.dirname(abs)));

    // routePath computed from folder path
    const routePath = buildRoutePath(relDirToApp);

    const segmentGroup = findSegmentGroup(relDirToApp.split("/").filter(Boolean));

    routes.push({
      routePath,
      filePath: relToRepo,
      kind,
      segmentGroup,
    });
  }
}

function stableSort(routes: RouteEntry[]) {
  routes.sort((a, b) => {
    const k1 = `${a.routePath}::${a.kind}::${a.filePath}`;
    const k2 = `${b.routePath}::${b.kind}::${b.filePath}`;
    return k1.localeCompare(k2);
  });
}

function main() {
  if (!isDir(APP_ROOT)) {
    console.error(`Missing src/app directory at: ${APP_ROOT}`);
    process.exit(1);
  }

  const routes: RouteEntry[] = [];
  walk(APP_ROOT, routes);
  stableSort(routes);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const out = {
    routes,
    metadata: {
      generatedAt: nowIso(),
      totalRoutes: routes.length,
    },
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`Wrote: ${normalizeSlashes(path.relative(REPO_ROOT, OUT_FILE))} (${routes.length} routes)`);
}

main();
