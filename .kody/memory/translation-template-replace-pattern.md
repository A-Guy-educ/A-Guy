---
name: translation-template-replace-pattern
title: Translation Template Replace Pattern
type: lesson
source: task:2113
recorded_at: 2026-05-26T14:31:56Z
---

Translation strings with parameters use a `.replace('{key}', value)` pattern rather than a `.t('key', { key: value })` object-notation. The `t()` function in `useTranslations` returns a plain string with no template interpolation support. Always use `.replace()` for substitution. Source: issue #2113.

Why: The `useTranslations` hook returns `(key: string) => string` — it resolves the key to a plain string and does NOT support `{placeholder}` interpolation. Using object notation like `t('key', { product: name })` would cause TypeScript errors.

How to apply: When writing new translation keys that need variable substitution, use `t('key').replace('{param}', value)` pattern as seen in checkout success/cancel pages.

**Why:** The codebase consistently uses .replace() for i18n interpolation. Using object notation would compile but produce broken output at runtime.

**Source task:** `2113`
