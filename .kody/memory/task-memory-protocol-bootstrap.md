---
name: task-memory-protocol-bootstrap
title: Write context.json and memory-recs.json at end of every kody task
type: lesson
source: job:task-memory-extractor:from-989489AA-7167-4538-A73B-19CBD84ABBB8
recorded_at: 2026-05-20T19:31:01Z
---

**Why:** The per-task memory artifacts are REQUIRED at task end per AGENTS.md — the protocol enables cross-task memory persistence and must be bootstrapped on day one, not retrofitted.
**How to apply:** At task end, always write .kody/tasks/<taskId>/context.json and .kody/tasks/<taskId>/memory-recs.json before concluding.

**Source task:** `989489AA-7167-4538-A73B-19CBD84ABBB8`
