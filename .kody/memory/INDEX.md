# Kody memory index

One line per memory. The `memory-writer` job maintains this file — do not edit by hand.
To add a memory, drop a sticky note in [`inbox/`](inbox/README.md) and the job will file it.

Each entry: `- [Title](id.md) — one-line hook (type: <type>)`.
- [User prefers concise answers](user-prefers-concise-answers.md) — The user explicitly stated a preference for short, simple answers in responses. (type: user)
- [Kody does not address issues on goal branches directly](kody-does-not-address-issues-on-goal-branches-directly.md) — The Kody engine cannot directly address issues on goal branches; new work must be initiated from the default branch. (type: feedback)
- [pnpm Version Pinned to 10.33.0](decisions/pnpm-version-pinning.md) — pnpm 10.33.0 pinned via packageManager field to avoid ERR_PNPM_LOCKFILE_CONFIG_MISMATCH on pnpm 11 runners. (type: decision)
- [CSP Whitelists Vercel Live Domain](decisions/csp-vercel-live-whitelist.md) — vercel.live added to admin CSP script-src and connect-src so Vercel dev overlay works on /admin. (type: decision)
- [A-Guy memory system bootstrap smoke test](aguy-memory-bootstrap.md) — Verify A-Guy's memory-writer drains the inbox and files notes correctly. (type: lesson)

- [PR #1705: #1695: Restrict Coupons read access to admins](pr-1705.md) — #1695: Restrict Coupons read access to admins — merged 2026-05-19 by @aguyaharonyair (type: decision)

- [PR #1709: #1699: Atomic coupon usage increment + move consumption to webhook succ…](pr-1709.md) — #1699: Atomic coupon usage increment + move consumption to webhook succ… — merged 2026-05-19 by @aguyaharonyair (type: decision)

- [PR #1713: #1711: Record refundedAmount, refundedBy, refundedAt on refund](pr-1713.md) — #1711: Record refundedAmount, refundedBy, refundedAt on refund — merged 2026-05-19 by @aguyaharonyair (type: decision)

- [PR #1714: #1710: Grant entitlements before flipping Transaction to succeeded](pr-1714.md) — #1710: Grant entitlements before flipping Transaction to succeeded — merged 2026-05-20 by @aguyaharonyair (type: decision)

- [PR #1719: #1712: URL-encode cancelUrl params and validate productId as ObjectId](pr-1719.md) — #1712: URL-encode cancelUrl params and validate productId as ObjectId — merged 2026-05-20 by @aguyshayb (type: decision)

- [PR #1722: #1720: Fix lesson-duplication prompts that omit hint / fullSolution fro…](pr-1722.md) — #1720: Fix lesson-duplication prompts that omit hint / fullSolution fro… — merged 2026-05-20 by @aguyaharonyair (type: decision)

- [PR #1724: fix(prompts): Add missing hint/solution/fullSolution to example outputs](pr-1724.md) — fix(prompts): Add missing hint/solution/fullSolution to example outputs — merged 2026-05-20 by @aguyshayb (type: decision)

- [PR #1728: #1725: Move PayPal entitlement grant from CHECKOUT.ORDER.APPROVED to PA…](pr-1728.md) — #1725: Move PayPal entitlement grant from CHECKOUT.ORDER.APPROVED to PA… — merged 2026-05-20 by @aguyaharonyair (type: decision)

- [PR #1732: #1726: Stripe charge.refunded partial-refund — do not flip whole transa…](pr-1732.md) — #1726: Stripe charge.refunded partial-refund — do not flip whole transa… — merged 2026-05-20 by @aguyaharonyair (type: decision)

- [PR #1735: #1733: Make pass-2 solution derivation per-block in lesson duplication](pr-1735.md) — #1733: Make pass-2 solution derivation per-block in lesson duplication — merged 2026-05-20 by @aguyaharonyair (type: decision)
