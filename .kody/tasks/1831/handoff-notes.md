# Issue #1831 - Investigation Notes

## Bug Description
"/study page title mismatches rendered content" - Browser tab shows 'לימוד - A-Guy' (study page metadata) but page body shows /start hero content with guest nav.

## Investigation Findings

### Issue #1830 Already Fixed This
The related issue #1830 fixed a redirect chain where `/ask`, `/practice`, `/test`, `/study` routes redirected to `/` (homepage) when gradeLevel was missing, which then redirected to `/start`. This caused a confusing UX where users would see a brief flash of /start content.

### Root Cause (from #1830)
- StudyContent and similar components checked for `gradeLevel` in localStorage
- If missing, redirected to `window.location.href = '/'`
- Homepage redirected to `/start` when no CMS page exists
- This created a redirect chain: /study → / → /start

### Fix Already Applied (from #1830)
Changed all redirect targets from `/` to `/courses`:
- `src/app/(frontend)/study/_components/StudyContent/index.tsx:137` → `window.location.href = '/courses'`
- Similar fixes in AskContent, AskConversationGrid, and RequireCourseSelection guard

### Verification
- No `window.location.href = '/'` found in study-related files
- Current redirect is to `/courses` (correct)
- Quality gates (typecheck, lint) pass

## Conclusion
Issue #1831 appears to be a duplicate or follow-up of #1830. The fix from #1830 is already in place and correctly addresses the root cause of the title/body mismatch described in #1831.
