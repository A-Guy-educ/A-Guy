# Kody memory index

One line per memory. The `memory-writer` job maintains this file — do not edit by hand.
To add a memory, drop a sticky note in [`inbox/`](inbox/README.md) and the job will file it.

Each entry: `- [Title](id.md) — one-line hook (type: <type>)`.
- [User prefers concise answers](user-prefers-concise-answers.md) — The user explicitly stated a preference for short, simple answers in responses. (type: user)
- [Kody does not address issues on goal branches directly](kody-does-not-address-issues-on-goal-branches-directly.md) — The Kody engine cannot directly address issues on goal branches; new work must be initiated from the default branch. (type: feedback)
- [pnpm Version Pinned to 10.33.0](decisions/pnpm-version-pinning.md) — pnpm 10.33.0 pinned via packageManager field to avoid ERR_PNPM_LOCKFILE_CONFIG_MISMATCH on pnpm 11 runners. (type: decision)
- [CSP Whitelists Vercel Live Domain](decisions/csp-vercel-live-whitelist.md) — vercel.live added to admin CSP script-src and connect-src so Vercel dev overlay works on /admin. (type: decision)
- [A-Guy memory system bootstrap smoke test](aguy-memory-bootstrap.md) — Verify A-Guy's memory-writer drains the inbox and files notes correctly. (type: lesson)
