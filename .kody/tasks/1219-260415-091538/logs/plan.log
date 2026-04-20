**Status: Complete**

The security scanner fix has been applied to `scripts/inspector/plugins/project/security-scanner/rules.ts`:

```diff
-  /withApiHandler\s*\(/,
+  /withApiHandler(?:\s*<[^>]+>)?\s*\(/, // Handles TypeScript generics: withApiHandler<T>()
```

**Verification results:**
- 5 falsely-flagged routes are no longer detected by the scanner
- Unit tests pass: 8/8

**Note:** The remaining 2 routes (`course-syllabus/route.ts`, `cron/warmup/route.ts`) that still appear as missing auth are genuinely missing authentication and were not part of the original 5 findings.
