# Memory sticky-note inbox

Writers drop one JSON file per memory they want recorded. The `memory-writer`
job drains this folder on its tick, files each note under `.kody/memory/`,
updates `INDEX.md`, and deletes the processed sticky note.

## File shape

Filename: `<utc-iso>-<source>-<short-uuid>.json` — must be unique so parallel
writers never collide.

Example: `2026-05-20T14-03-22Z-chat-abc123.json`

Body:

```json
{
  "type": "preference | decision | lesson | verdict | architecture",
  "name": "kebab-case-slug",
  "title": "Human-readable title for INDEX.md",
  "hook": "One-line hook for INDEX.md",
  "body": "Full markdown content for the memory file (no frontmatter — the job adds it).",
  "source": "chat | executor:<executable> | dashboard:<action> | job:<slug>",
  "ts": "2026-05-20T14:03:22Z",
  "links": ["other-memory-slug"]
}
```

## Rules

- Never edit an existing sticky note — drop a new one if you change your mind.
- Never write to `.kody/memory/*.md` directly from a writer. The job owns those.
- A sticky note with the same `name` as an existing memory file is treated as
  an update (the job overwrites the body and refreshes the INDEX line).
- Sticky notes are transient. After processing, the job deletes them. The
  permanent record is the memory file plus the git history of this folder.
