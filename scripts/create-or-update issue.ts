// scripts/github-issue-upsert.ts
//
// Generic "upsert issue" script:
// - Finds an open issue by title (and optional label).
// - If found -> updates body/labels.
// - If not found -> creates a new issue.
//
// Auth:
// - Requires GITHUB_TOKEN env var with "issues:write" permission.
// - Requires GITHUB_REPOSITORY env var (owner/repo), or pass --repo.
//
// Usage examples:
//   pnpm tsx scripts/github-issue-upsert.ts \
//     --title "Repo hygiene findings (automated)" \
//     --body-file ".ai-docs/reports/repo-hygiene-report.md" \
//     --labels "automation,repo-hygiene,tech-debt" \
//     --dedupe-label "repo-hygiene" \
//     --mode upsert
//
//   pnpm tsx scripts/github-issue-upsert.ts \
//     --title "Dependency security findings (daily)" \
//     --body "Audit non-zero. See artifact." \
//     --labels "automation,security,deps" \
//     --mode upsert
//

type Args = Record<string, string | boolean | undefined>;

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function required(args: Args, k: string): string {
  const v = args[k];
  if (!v || typeof v !== "string") throw new Error(`Missing required arg: --${k}`);
  return v;
}

function csv(v?: string): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function gh<T>(
  token: string,
  method: "GET" | "POST" | "PATCH",
  url: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub API error ${res.status} ${res.statusText}: ${text}`);
  }

  return (await res.json()) as T;
}

function buildBody(args: Args): string {
  const fs = require("node:fs");
  const path = require("node:path");

  const inline = args["body"];
  const file = args["body-file"];

  let body = "";
  if (typeof inline === "string") body = inline;
  if (typeof file === "string") {
    const p = path.resolve(process.cwd(), file);
    body = fs.readFileSync(p, "utf8");
  }

  const prefix = typeof args["prefix"] === "string" ? args["prefix"] : "";
  const suffix = typeof args["suffix"] === "string" ? args["suffix"] : "";

  return [prefix, body, suffix].filter(Boolean).join("\n\n").trim();
}

type Issue = {
  number: number;
  title: string;
  state: "open" | "closed";
  labels: Array<string | { name: string }>;
};

function labelsToNames(labels: Issue["labels"]): string[] {
  return labels.map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing env: GITHUB_TOKEN");

  const repo =
    (typeof args["repo"] === "string" ? args["repo"] : process.env.GITHUB_REPOSITORY) || "";
  if (!repo.includes("/")) throw new Error("Missing repo. Provide --repo owner/repo or set GITHUB_REPOSITORY.");

  const [owner, name] = repo.split("/");
  const title = required(args, "title");
  const mode = (typeof args["mode"] === "string" ? args["mode"] : "upsert") as
    | "upsert"
    | "create-only"
    | "update-only";

  const labels = csv(typeof args["labels"] === "string" ? args["labels"] : "");
  const dedupeLabel = typeof args["dedupe-label"] === "string" ? args["dedupe-label"] : "";
  const body = buildBody(args);

  if (!body) throw new Error("Body is empty. Provide --body or --body-file.");

  // Find open issues by title (and optional label filter)
  // We use the Search API for reliability.
  // Query: repo:owner/name is:issue is:open in:title "..."
  let q = `repo:${owner}/${name} is:issue is:open in:title "${title.replaceAll('"', '\\"')}"`;
  if (dedupeLabel) q += ` label:"${dedupeLabel.replaceAll('"', '\\"')}"`;

  type SearchResp = { items: Issue[] };
  const search = await gh<SearchResp>(
    token,
    "GET",
    `https://api.github.com/search/issues?q=${encodeURIComponent(q)}`
  );

  const existing = (search.items || [])[0];

  // Create
  if (!existing) {
    if (mode === "update-only") {
      console.log(`No matching open issue found for title="${title}". Mode=update-only -> no-op.`);
      return;
    }

    type CreateResp = Issue;
    const created = await gh<CreateResp>(token, "POST", `https://api.github.com/repos/${owner}/${name}/issues`, {
      title,
      body,
      labels,
    });

    console.log(`Created issue #${created.number}: ${created.title}`);
    return;
  }

  // Update
  if (mode === "create-only") {
    console.log(`Found existing issue #${existing.number}. Mode=create-only -> no-op.`);
    return;
  }

  const existingLabelNames = labelsToNames(existing.labels);
  const mergedLabels = Array.from(new Set([...existingLabelNames, ...labels]));

  await gh(token, "PATCH", `https://api.github.com/repos/${owner}/${name}/issues/${existing.number}`, {
    body,
    labels: mergedLabels,
  });

  console.log(`Updated issue #${existing.number}: ${existing.title}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
