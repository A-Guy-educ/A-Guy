## Docs drift update for PR #2108 (Admin Components)

**What changed:** Updated the `InlineExerciseEditor` row in the components table (line 53 of `docs/admin-components/README.md`) to accurately describe the component as implemented in PR #2108:

- Fetches exercise content via `GET /api/exercises/:id` (REST API, not lesson form)
- Renders all exercise block types inline within the lesson view
- Lazy-loads geometry/axis editors via `React.lazy()` (jsgraph bundle optimization)
- `contentPageRef` blocks still navigate away to the admin editor (not inline) — documented as a known limitation

No other doc sections required updating; the inline save pattern and component hierarchy were already described.

**No code changes** — only documentation.
