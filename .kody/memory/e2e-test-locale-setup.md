---
name: e2e-test-locale-setup
title: E2E Test Locale Setup
type: lesson
source: task:2203
recorded_at: 2026-05-31T19:18:16Z
---

When E2E tests authenticate users via API (authenticateViaAPI), the payload-token cookie is set but NEXT_LOCALE cookie is not. This causes middleware to detect locale from Accept-Language header, which in CI environments is often English. **Why:** The middleware only sets x-locale header when shouldSetCookie=true, which happens when locale comes from Accept-Language. But when reading from existing cookie, shouldSetCookie=false, so x-locale is not set. **How to apply:** Any E2E test that authenticates a user and then checks i18n content must set the locale cookie explicitly after login.

**Why:** Prevented a day of debugging why Hebrew content test passed locally but failed in CI due to Accept-Language difference

**Source task:** `2203`
