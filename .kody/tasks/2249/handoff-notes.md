## Task 2249 — Docs drift check for PR #2161

### What I did
- Read `docs/admin-components/README.md` fully
- Read `src/ui/web/AdminBar/AdminBarWrapper.tsx` and `src/ui/web/AdminBar/index.tsx`
- Read `src/app/(frontend)/layout.tsx` (shows how AdminBarWrapper is used)
- Fetched PR #2161 diff via `gh pr view 2161`

### Conclusion: Doc-irrelevant — no update needed

PR #2161 added `AdminBarWrapper` to fix a visual bug (thin white strip at top of homepage). The wrapper conditionally renders `AdminBar` only when `useSelectedLayoutSegments()` returns non-empty segments (i.e., on admin pages).

The doc `docs/admin-components/README.md` covers **Payload admin field components** — custom React components registered via `admin.components.Field/Cell/Label` in collection configs, stored under `src/components/admin/` and `src/ui/admin/`. `AdminBarWrapper` is a **frontend** Next.js component under `src/ui/web/AdminBar/`. It:
- Does NOT use Payload's component registration system
- Does NOT appear in any collection config
- Is NOT referenced in the doc anywhere (grep confirms no "AdminBar" match)

Therefore the doc does not need updating. The issue can be closed with a comment explaining the change was doc-irrelevant.
