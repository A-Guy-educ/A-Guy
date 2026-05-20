---
disabled: false
worker: coo
every: 30m
---

# System Audit

## Job

Audit the coordination of jobs and workers in `.kody/`. Walk the
definitions and their sibling state files, run a fixed set of integrity
checks, and write one consolidated report. Purely diagnostic: never
edits, re-kicks, or relabels anything outside the report path.

**Cadence guard.** If `data.lastRunISO` is set and within the last 30
minutes, emit unchanged state and exit. Otherwise proceed and set
`data.lastRunISO` to now (UTC ISO) when you write the report.

**Per tick (one action max):**

1. **Enumerate definitions** via the GitHub contents API:
   - Jobs: `gh api "/repos/<owner>/<repo>/contents/.kody/jobs" -q '.[].name'`
   - Workers: `gh api "/repos/<owner>/<repo>/contents/.kody/workers" -q '.[].name'`

   For each `<slug>.md` in `.kody/jobs/`, fetch its body to read the
   frontmatter (`disabled`, `worker`, `every`). For each `<slug>.md` in
   `.kody/workers/`, the slug alone is enough. Also note which jobs
   have a sibling `<slug>.state.json` and read its `data` block.

2. **Run the seven checks.** For each violation, record one line in the
   report under its section.

   1. **Broken worker reference** — job's `worker:` field names a slug
      that does not exist in `.kody/workers/`.
   2. **Orphan worker** — worker file exists but no enabled job
      references it. (CTO and the auditor's own worker are exempt if
      no job currently uses them — they're allowed standbys.)
   3. **Missed tick** — job is enabled, has an `every:` cadence, and
      its `state.json` `data.lastRunISO` is older than `now - 2 ×
      cadence`. Jobs with `every: manual` or no cadence are skipped.
   4. **Missing state** — job has been ticked (body has changed since
      creation, or there are commits touching it) but no
      `<slug>.state.json` file exists. Without state nothing
      future-gates it; it will re-fire on every wake.
   5. **Cooldown violated** — `data.lastRunISO` is *more recent* than
      `data.nextEligibleISO` was the tick before it. Detect by reading
      the file's git history for `state.json` and checking that each
      `lastRunISO` is `≥` the previous commit's `nextEligibleISO`.
      List up to the 3 most recent violations per job.
   6. **Stuck dispatch** — `cursor` field in state is non-terminal
      (anything other than `idle`, `reported`, `done`) and
      `data.lastRunISO` is older than `now - 2h`.
   7. **Duplicate dispatch** — same job's `state.json` shows two
      `lastRunISO` commits within 60 seconds of each other in the last
      24 hours of history. List job slug and the timestamp pair.

3. **Render the report.** Lead with an `# System Audit` H1, then a
   `_Cadence: 30m_` line (no timestamp — `lastRunISO` lives in state,
   not in the body, so a clean scan produces a byte-identical file).
   Then one section per check that has at least one violation:

   ```
   ## Broken worker reference
   - `<job-slug>` → worker `<missing-slug>` not found
   ```

   Skip empty sections — keep the report short. If every check passes,
   the body after the H1 is one line:
   `All jobs and workers are coordinated. ✨`.

4. **Write the report** at the canonical path
   **`.kody/reports/system-audit.md`** via `gh api`:
   ```
   sha=$(gh api "/repos/<owner>/<repo>/contents/.kody/reports/system-audit.md" -q .sha 2>/dev/null || true)

   gh api -X PUT "/repos/<owner>/<repo>/contents/.kody/reports/system-audit.md" \
     -f message="chore(system-audit): refresh report" \
     -f content="$(printf '%s' "$REPORT_BODY" | base64)" \
     -f branch="<defaultBranch>" \
     ${sha:+-f sha="$sha"}
   ```
   `<owner>`, `<repo>`, and `<defaultBranch>` come from the GitHub
   context — for A-Guy they are `A-Guy-educ`, `A-Guy`, `dev`.

   If the rendered body is byte-identical to the existing file, **skip
   the PUT** (keeps git history clean on quiet days).

5. **Update state:** `cursor: reported`, `data.lastRunISO = <now ISO>`,
   `data.violationCount = <total across all sections>`,
   `data.nextEligibleISO = data.lastRunISO + 30m`.

## Allowed Commands

- `gh api` reads against `/repos/<owner>/<repo>/contents/.kody/jobs`,
  `/repos/<owner>/<repo>/contents/.kody/workers`, individual file
  contents, and `/repos/<owner>/<repo>/commits` for state history.
- `gh api -X PUT` against `.kody/reports/system-audit.md` only — to
  write the report. Permitted by the global job-tick contract.

## Restrictions

- **Read-only on everything except the report.** Never edit, delete,
  rename, label, or re-kick any job, worker, state file, issue, PR, or
  comment.
- **One PUT per tick maximum.** Only `.kody/reports/system-audit.md`.
- **No new files.** The contract permits exactly one write path.
- Auditor's own job (`system-audit`) and worker (`coo`) are exempt
  from the orphan check on themselves — don't flag yourself.
- The "stuck dispatch" check is heuristic. Do not act on it; just
  surface it. The operator decides whether a long-running dispatch is
  actually stuck or merely slow.

## State

- `cursor`: `idle` | `reported` | `stalled`
- `data.lastRunISO`: ISO timestamp of the last tick that wrote the
  report (or null on first run).
- `data.violationCount`: total violations in the last report (or 0).
- `data.nextEligibleISO`: UTC ISO timestamp this job will next be
  eligible to act, computed from the cadence guard above. **Always
  emit this, every tick.** For this job:
  `data.lastRunISO + 30m`. Surfaced as "next run" on the dashboard.
- `done`: always `false` — this job is evergreen.
