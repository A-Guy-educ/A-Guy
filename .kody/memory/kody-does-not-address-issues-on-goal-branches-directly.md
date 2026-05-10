---
name: "Kody does not address issues on goal branches directly"
description: "The Kody engine cannot directly address issues on goal branches; new work must be initiated from the default branch."
type: feedback
created: 2026-05-10T13:07:28.622Z
---

Why: User stated this limitation (Kody does not know how to address issues in a goal branch). This refers to the Kody engine's operational constraints.
How to apply: When planning new work or fixes for an existing feature that originated from a goal, always propose creating a new issue on the default branch (e.g., `main`) for Kody to act on. Do not suggest or attempt to make Kody address issues directly within an already-active `goal-*` branch.
