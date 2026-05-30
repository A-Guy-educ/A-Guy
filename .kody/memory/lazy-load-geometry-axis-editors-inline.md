---
name: lazy-load-geometry-axis-editors-inline
title: Lazy Load Geometry Axis Editors Inline
type: decision
source: task:2104
recorded_at: 2026-05-26T14:31:56Z
---

The question_geometry, question_axis, and question_multi_axis block types use React.lazy() to dynamically import GeometryEditor. This prevents bundling jsxgraph in the admin panel load.

**Why:** These editors are heavy (jsxgraph) and not always needed. The dynamic import pattern was already used in ExerciseContentEditor, so the same approach was followed for consistency.

**Source task:** `2104`
