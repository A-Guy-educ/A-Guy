# OpenCode Pipeline

Automated development pipeline for A-Guy project using OpenCode CLI agents.

## Pipeline Flow

```
┌─────────────────────── SPEC PHASE ───────────────────────┐
│                                                           │
│  taskify ──→ [gate?] ──→ gap ──→ [clarify: opt-in]       │
│  (agent)     hard-stop   (agent)   (agent)                │
│              if high-risk                                  │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────── IMPL PHASE ───────────────────────┐
│                                                           │
│  architect ──→ [gate?] ──→ plan-gap ──→ build ──────┐     │
│  (agent)       risk-gated   (agent)     (agent)     │     │
│                if medium+                           │     │
│                                                     ▼     │
│                                          ┌──────────────┐ │
│                                          │ Quality Gates │ │
│                                          │  tsc + tests  │ │
│                                          └──────┬───────┘ │
│                                            pass? │        │
│                                         ┌───no───┴──yes──┐│
│                                         ▼                ▼│
│                                    Re-invoke         commit│
│                                    build agent      (script)│
│                                    (up to 2x)          │  │
│                                                        ▼  │
│                                                    verify  │
│                                                   (script) │
│                                                   tsc+lint │
│                                                   +format  │
│                                                   +tests   │
│                                                     │      │
│                                              fail? ─┤      │
│                                              lint:fix      │
│                                              format:fix    │
│                                              (scripted,    │
│                                               up to 2x)   │
│                                                     │      │
│                                                     ▼      │
│  review ──→ fix ──→ commit ──→ verify ──→ pr               │
│  (agent)   (build   (script)   (script)   (script)         │
│             agent)                                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Stages

| Stage     | Type     | Model          | Input                     | Output       |
| --------- | -------- | -------------- | ------------------------- | ------------ |
| taskify   | agent    | MiniMax-M2.5   | task.md                   | task.json    |
| gap       | agent    | MiniMax-M2.5   | task.md, task.json        | spec.md      |
| clarify   | agent    | GPT-5.2        | task.md, spec.md          | clarified.md |
| architect | agent    | Opus 4.6       | spec.md, clarified.md     | plan.md      |
| plan-gap  | agent    | Opus 4.6       | spec.md, plan.md          | plan-gap.md  |
| build     | agent    | MiniMax-M2.5   | spec.md, plan.md + errors | build.md     |
| commit    | scripted | —              | task.json                 | commit.md    |
| review    | agent    | Opus 4.6       | build.md, plan.md, spec   | review.md    |
| fix       | agent    | MiniMax-M2.5   | review.md, verify.md      | fix-summary  |
| verify    | scripted | —              | code                      | verify.md    |
| pr        | scripted | —              | task files                | pr.md        |

**Stage types:**
- **agent** — Runs via LLM agent (opencode)
- **scripted** — Runs directly via script (no LLM, fast)

Override any model with `OPENCODE_MODEL` env var.

## Build → Quality Gate Loop (Key Design)

After the build agent finishes, quality gates run automatically:

```
build agent exits
    │
    ▼
validate src changes ──→ commit code (preserve work)
    │
    ▼
run gates: tsc + unit tests
    │
    ├── ALL PASS ──→ continue to review
    │
    └── FAIL ──→ write build-errors.md
                     │
                     ▼
                re-invoke BUILD agent (not a separate agent!)
                     │  • has full context (spec, plan, code intent)
                     │  • reads build-errors.md
                     │  • fixes its own code
                     │
                     ▼
                re-run ALL gates
                     │
                     ├── PASS ──→ continue
                     └── FAIL ──→ retry once more (max 2 attempts)
                                     │
                                     └── still failing ──→ pipeline FAILS
```

**Why the build agent, not a separate autofix agent?**
- Build agent wrote the code — it knows the intent
- It has spec, plan, and full context
- No cold-start penalty (same agent type)
- One agent fixes everything (tsc, lint, format, AND tests)

## Verify Stage (Post-Commit)

After commit, verify runs tsc + lint + format + tests. If lint/format fail:

```
verify fails
    │
    ▼
pnpm lint:fix + pnpm format:fix  (scripted, no LLM)
    │
    ▼
re-run verify (max 2 attempts)
```

No LLM agent needed — lint and format fixes are mechanical.

## Control Modes (Gates)

| Mode       | Trigger              | Gate Points                     | Use Case                          |
| ---------- | -------------------- | ------------------------------- | --------------------------------- |
| Auto       | `risk_level: low`    | None                            | Bug fixes, docs, low-risk changes |
| Risk-Gated | `risk_level: medium` | After architect                 | New features, refactors           |
| Hard Stop  | `risk_level: high`   | After taskify + after architect | DB changes, security, billing     |

- `/cody --auto` — Force auto mode (skip all gates)
- `/cody --gate` — Force risk-gated mode
- `/cody approve` — Approve and resume pipeline
- `/cody reject` — Cancel the task

## Task Types & Pipelines

| Task Type | Pipeline                                                             |
| --------- | -------------------------------------------------------------------- |
| feat      | taskify → gap → architect → plan-gap → build → commit → review → fix → commit → verify → pr |
| fix       | taskify → gap → architect → plan-gap → build → commit → review → fix → commit → verify → pr |
| refactor  | taskify → gap → architect → plan-gap → build → commit → review → fix → commit → verify → pr |
| docs      | build → commit → verify → pr                                        |

## Task Structure

```
.tasks/
└── <YYMMDD-task-name>/
    ├── task.md           # PRD/requirements (YOU write this)
    ├── task.json         # Task classification (taskify agent)
    ├── spec.md           # Detailed spec (gap agent)
    ├── clarified.md      # Q&A answers or "Use recommended answers."
    ├── plan.md           # Implementation plan (architect agent)
    ├── plan-gap.md       # Gap analysis report (plan-gap agent)
    ├── build.md          # Build report (build agent)
    ├── build-errors.md   # Quality gate errors (for build retry, deleted on success)
    ├── commit.md         # Commit report (scripted)
    ├── review.md         # Code review (review agent)
    ├── fix-summary.md    # Fix report (fix agent)
    ├── verify.md         # Verification results (scripted)
    ├── pr.md             # PR summary (scripted)
    └── status.json       # Pipeline status tracking
```

## Running the Pipeline

### Via GitHub Issue Comment

```
/cody                              # Full pipeline, auto-generate task-id
/cody --clarify                    # With clarify stage enabled
/cody fix the tests                # Rerun with feedback
/cody spec 260217-user-metrics     # Run spec phase only
/cody impl 260217-user-metrics     # Run impl phase only
/cody rerun 260217-user-metrics --feedback "fix this"
/cody status 260217-user-metrics   # Check pipeline status
```

### Via Local CLI

```bash
pnpm cody:run --task-id=260217-user-metrics --mode=full --local
pnpm cody:run --task-id=260217-user-metrics --mode=impl --local
pnpm cody:run --task-id=260217-user-metrics --mode=rerun --from=build --feedback="fix this" --local
```

## Commit Format

```
<type>(<scope>): <Subject in sentence case>

<Body with at least 20 characters>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `security`

## Branch Naming

- `feat/<task-name>` — Features
- `fix/<task-name>` — Bug fixes
- `chore/<task-name>` — Maintenance
- `refactor/<task-name>` — Refactoring
- `docs/<task-name>` — Documentation
