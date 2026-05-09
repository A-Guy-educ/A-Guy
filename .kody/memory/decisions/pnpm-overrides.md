---
title: pnpm Lockfile Overrides Policy
type: decision
updated: 2026-05-09
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1503
---

The project's `pnpm-lock.yaml` must include an `overrides` block matching any version constraints declared in `package.json`'s `pnpm.overrides`. Without it, `pnpm install --frozen-lockfile` fails in CI.

## The Problem

`pnpm-lock.yaml` was regenerated locally with pnpm 11 and silently dropped the `@modelcontextprotocol/sdk: >=1.25.2` override that existed in `package.json`. The mismatch only surfaced when CI's `pnpm/action-setup@v4` (which pins pnpm 10.33.0) ran on a new PR.

The CI workflow only fires on `pull_request`, `push to main`, and `workflow_dispatch` — not on direct pushes to `dev`. This allowed the regression to live on `dev` undetected.

## The Fix

Regenerate `pnpm-lock.yaml` with the same pnpm version used by CI (`pnpm 10.33.0`). The resulting lockfile includes the expected `overrides:` block.

## Rule

When adding or modifying `pnpm.overrides` in `package.json`, regenerate `pnpm-lock.yaml` with the CI's pinned pnpm version before committing. Verify with `pnpm install --frozen-lockfile` locally before opening the PR.
