Resolved a single asymmetric merge conflict in `src/payload.config.ts` lines 91–103.

**Conflict type:** Asymmetric — HEAD added `PAYLOAD_GENERATE_IMPORTMAP` check alongside `PAYLOAD_GENERATE_TYPES`; dev added `CI` env var check instead.

**Resolution:** Took HEAD (PR #2431) side — it correctly covers both `generate:types` and `generate:importmap` scripts, which is what #2427 ("dev server not running") requires to allow `pnpm dev` to start without a live database.

No other conflicts. Typecheck and lint both pass.
