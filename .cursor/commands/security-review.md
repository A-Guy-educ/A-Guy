---
name: Security Review
description: Check for common Payload security issues
---

Review code for these critical security patterns:

1. **Local API Access Control**
   - When passing `user`, ensure `overrideAccess: false` is set
   - Search for: `payload.find`, `payload.create`, `payload.update`, `payload.delete`

2. **Transaction Safety**
   - Ensure `req` is passed to nested operations in hooks
   - Check `afterChange`, `beforeChange`, `afterDelete` hooks

3. **Hook Loops**
   - Check for `context.skipHooks` pattern in hooks that trigger updates

Run: `grep -r "overrideAccess" src/` to find Local API usage.

