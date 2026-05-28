---
name: inline-exercise-editor-per-exercise-save-via-rest
title: Inline Exercise Editor Per Exercise Save Via Rest
type: decision
source: task:2104
recorded_at: 2026-05-26T14:31:56Z
---

InlineExerciseEditor saves directly to /api/exercises/:id via REST API (PATCH) rather than through the lesson form. This allows independent saving per exercise without navigating away.

**Why:** The lesson form's blocks field is a textarea (JSON string), not a relationship. Saving per-exercise changes through it would require parsing/serializing the whole blocks array. Direct REST API call is simpler and more reliable.

**Source task:** `2104`
