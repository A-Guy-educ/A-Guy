
### build (2026-04-03T08:18:20)
No type errors. Here's what was done:

1. **`status` column** — already present in `defaultColumns`, no change needed.
2. **`chapters` count column** — added a `join` field of type `join` pointing to the `chapters` collection via the `course` foreign key. This is Payload 3.x's built-in mechanism for reverse relationships; the admin list view renders it as a count badge.
3. Added `'chapters'` to `defaultColumns` so it shows in the list view.
4. Regenerated types (`pnpm generate:types`) — succeede
...(truncated)
