---
every: 30m
staff: qa
mentions: aguyaharonyair
---

# QA Changelog Verification

## Job

Verify every shipped-but-unverified scenario in `CHANGELOG.md` against the live
app, and record the verdict **back into the changelog** — the changelog *is*
this job's state. Each `## [Unreleased]` bullet (one per merged PR) carries a
trailing QA marker, appended after the `— @author`, joined by ` · `:

| State        | Marker                          |
| ------------ | ------------------------------- |
| **untested** | _(none)_                        |
| **running**  | ` · 🔄 QA (#<tracking>)`        |
| **verified** | ` · ✅ QA <YYYY-MM-DD>`          |
| **issues**   | ` · ⚠️ QA <YYYY-MM-DD> (#<n>)`   |

Browsing is delegated to the `qa-engineer` executable (the job runs no browser
itself); the job opens a tracking issue, dispatches the run onto it, and reads
the verdict back on a later tick. **One run in flight at a time** — this bounds
browser cost.

`disabled: true` only to avoid auto-activating QA — this repo is already set up:
`CHANGELOG.md` has a populated `## [Unreleased]` section, `qa.fallbackUrl` in
`kody.config.json` (`https://dev.aguy.co.il`) resolves the target URL, the
`LOGIN_USER` variable + `LOGIN_PASSWORD` secret carry the QA credentials, and
the `.kody/context/*.md` entries tagged for `qa-engineer` carry the route list
+ flows. Flip to `disabled: false` to go live; no other setup needed.

**Per tick (one action max):**

1. Read the Unreleased section once:
   `gh api repos/{owner}/{repo}/contents/CHANGELOG.md --jq '.content' | base64 --decode`
   — take only the bullets between `## [Unreleased]` and the next `## [`.
   Ignore versioned sections (they shipped before QA existed).

2. **If a bullet is marked `🔄 QA (#n)`** (a run is in flight) → read its
   tracking issue: `gh issue view <n> --json state,title,comments,labels,createdAt`.
   - **No `qa-engineer` report yet, issue < 2h old** → emit unchanged state, exit.
   - **Report present** → read the verdict (`QA [PASS|CONCERNS|FAIL]` title or
     `kody:qa-report` label — do not free-text guess):
     - **PASS** → swap the marker to ` · ✅ QA <today>`, close the tracking
       issue, post one **informational** inbox rec (already shipped — clear to
       ship, so it carries **no** `kody-cmd:` line; the operator just dismisses).
     - **CONCERNS / FAIL** → swap the marker to ` · ⚠️ QA <today> (#<tracking>)`,
       **leave the tracking issue open** (the `qa-goal` verb reads the report
       from it on approve), and post one inbox rec whose `kody-cmd:` is
       `@kody qa-goal --issue <tracking> --scope "<title>"` — approving promotes
       qa-engineer's report into a fix goal. Never `@kody approve`.
   - **Stuck** (no report, issue ≥ 2h old) → strip the marker (back to
     untested), comment the stall on the tracking issue, exit. A `🔄` must never
     block QA forever.

   Apply the marker swap (✅/⚠️) or strip via the **byte-safe write recipe**
   below — edit one bullet on disk, never retype the file. Exit after
   resolving — the changelog write is your single mutation this tick.

3. **Else (nothing in flight)** → pick the **oldest untested** bullet: the
   bottom-most one with a `[#<pr>]` link and no marker. If none, idle. For it:
   1. Open a tracking issue:
      `gh issue create --title "QA: <title> (#<pr>)" --label kody:qa --body "Automated QA pass for changelog entry #<pr>; qa-engineer reports here."`
   2. Dispatch the pass onto it via **typed workflow_dispatch** — never a
      bot `@kody` comment (the webhook's bot-author guard silently drops
      those, which is exactly how this duty used to stall for hours).
      `qa-engineer` reads the scope from the tracking issue title via its
      `deriveQaScopeFromIssue` preflight, so no `--scope` flag is needed:
      `gh workflow run kody.yml -f executable=qa-engineer -f issue_number=<tracking>`
   3. Mark the bullet ` · 🔄 QA (#<tracking>)` using the **byte-safe write
      recipe** below — `OLD` is the bullet exactly as it appears, `NEW` is the
      same line with ` · 🔄 QA (#<tracking>)` appended. Never rewrite any other
      line, and never reconstruct the file yourself.

## Writing a marker (byte-safe — follow exactly)

Starting (🔄), swapping (✅/⚠️), and stripping a marker are the **same**
read-edit-PUT. **Never retype, paste, or otherwise reproduce the file contents
yourself** — doing so once collapsed the entire changelog onto a single line.
Edit a copy on disk and re-encode the file directly:

```bash
# 1. Fetch current file + sha (base64 -d preserves every byte, newlines included)
sha=$(gh api repos/{owner}/{repo}/contents/CHANGELOG.md --jq '.sha')
gh api repos/{owner}/{repo}/contents/CHANGELOG.md --jq '.content' | base64 -d > /tmp/CHANGELOG.md

# 2. Change EXACTLY one bullet's trailing marker on disk — no hand-editing
python3 - <<'EOF'
OLD = r"""<the target bullet line, verbatim, as it currently appears>"""
NEW = r"""<that same line with its trailing  ·  marker added / swapped / removed>"""
s = open("/tmp/CHANGELOG.md", encoding="utf-8").read()
assert s.count(OLD) == 1, f"want exactly 1 match, got {s.count(OLD)}"
open("/tmp/CHANGELOG.md", "w", encoding="utf-8").write(s.replace(OLD, NEW, 1))
EOF

# 3. PUT the WHOLE file back, encoded straight from disk — never from a shell var
gh api -X PUT repos/{owner}/{repo}/contents/CHANGELOG.md \
  -f message="chore(qa): <what changed>" \
  -f content="$(base64 -w0 /tmp/CHANGELOG.md)" \
  -f sha="$sha"
```

On a 409 (the file moved under you), re-run from step 1 with the fresh sha,
≤ 3 attempts. The `assert ... == 1` guard aborts when the bullet text is not
unique — fix `OLD` to include more of the line; never loosen the guard.

## Inbox recommendation format

One comment, terse. It **MUST** `@`-mention the operator on the first line —
that mention is the only thing that routes it into the dashboard inbox:

```
{{mentions}} 🧪 **QA result** — `<action>`

<one or two sentences: what was tested, the verdict, what confirming does>

<!-- kody-duty: {{duty}} -->
<!-- kody-cmd: @kody qa-goal --issue <tracking> --scope "<title>" -->

_Confirm or dismiss in the dashboard inbox. QA will not act on its own._
```

The `<!-- kody-duty: {{duty}} -->` line is **always required** (even on PASS,
where the `kody-cmd:` line is omitted) — it's how the dashboard keys trust to
this duty instead of the shared persona. Copy it verbatim.

`<action>` is `verified` (PASS — clear to ship) or `fix` (CONCERNS/FAIL).

- **PASS → omit the `kody-cmd:` line entirely.** The change already shipped; the
  rec is informational and the operator just dismisses it.
- **CONCERNS / FAIL → the `kody-cmd:` line is required:**
  `@kody qa-goal --issue <tracking> --scope "<title>"`. qa-engineer already
  posted its report on the tracking issue; on approve, `qa-goal` reads that
  report and promotes it into a fix goal (manifest entry + one fix-ticket per
  finding). The Approve button posts the line verbatim, so it MUST start with
  `@kody qa-goal --issue`, be one line, ≤ 300 chars. **Never emit
  `@kody approve`** — the engine has no `approve` verb. QA never creates the
  goal itself — that's gated behind your approval.

## Allowed Commands

- `gh api repos/{owner}/{repo}/contents/CHANGELOG.md` (read + `-X PUT` to write
  **only** a bullet's trailing marker — always via the byte-safe recipe above).
- `python3`, `base64` — the on-disk edit + lossless re-encode of the recipe.
- `gh issue list`, `gh issue create`, `gh issue view`, `gh issue comment`,
  `gh issue close`.
- `gh workflow run kody.yml` — typed cross-run dispatch for `qa-engineer`
  (never substitute `gh issue comment "@kody qa-engineer …"`; that path is
  bot-filtered and silently stalls).

## Restrictions

- **Advisory on outcomes.** Dispatching `qa-engineer` is read-only (it never
  commits). The `fix` rec is a recommendation only — never merge, approve a
  PR/review, label, or run a fix yourself.
- **One run in flight at a time.** If any bullet shows `🔄`, never start a
  second run this tick.
- **Changelog: markers only.** Edit solely the trailing ` · 🔄/✅/⚠️ …` segment.
  Never change entry text, reorder bullets, promote versions, or touch a
  versioned section.
  **Apply edits only via the byte-safe recipe (edit on disk, `base64 -w0` the
  file); never emit the file's contents yourself — that is what flattened it.**
- **One inbox recommendation per result**, only when a run resolves (step 2).
  The marker swap to ✅/⚠️ is what stops the same entry being re-processed.
- All writes go through `gh` — never `git commit`/`git push`, never open a PR.

## State

The **changelog markers are the state** — no separate ledger.

- `cursor`: always `idle` (state is per-bullet in the changelog, not global).
- `data.inflightPr`: number | null — mirror of the entry currently marked `🔄`,
  a consistency guard against a half-written tick. The changelog marker is
  authoritative.
- `data.nextEligibleISO`: always emit — surfaced as "next run" on the dashboard.
- `done`: always `false` — QA is evergreen.
