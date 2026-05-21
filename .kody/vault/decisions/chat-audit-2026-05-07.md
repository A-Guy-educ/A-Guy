---
title: Chat System Prompt Audit (2026-05-07)
type: decision
updated: 2026-05-07
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1472
  - docs/audits/2026-05-07-chat-system-prompt-audit.md
---

# Chat System Prompt Audit (2026-05-07)

**PR:** #1472

## Context

After three rounds of fixes on issue #1403 (#1404, #1450, #1459, #1461), the chat still answered with wrong data. Rather than continue patching, the team audited what actually reaches the model via the new `debug-prompt` endpoint.

## Findings Summary

| # | Finding | Severity | PR |
|---|---------|----------|-----|
| F1 | `select` clause strips `title`/`chapter` → empty lessonContextBlock | HIGH | #1473 |
| F2 | Exercises from reverse lookup, not `lesson.blocks[]`; pulls drafts + explanation pages | HIGH | #1474 |
| F3 | Exercises in arbitrary insertion order | MEDIUM | #1474 (same PR as F2) |
| F4 | 14,751-char system prompt, no per-exercise or total budget | MEDIUM | #1476 |
| F5 | Hint/solution fields leaked into prompt | HIGH content | #1475 (false alarm; verified clean) |
| F6 | `composeSystemInstructions` 8-positional-arg drift | MEDIUM maint | deferred |
| F7 | No admin Prompt or default Prompt on `lesson-1` | PRODUCT | content task |

## Fix Sequence

Each finding got its own small PR titled "implements F\<n\> from audit". Each PR snapshots the debug-prompt response before/after to catch regressions.

## Verification

Canonical test lesson: `lesson-1` (id `69a01f6bc774d3c6ad807afd` — "דימיון משולשים").

## Related

- [Chat System Architecture](../architecture/chat-system.md)
- [Runbook: Chat Debug Prompt](../runbooks/chat-debug-prompt.md)
