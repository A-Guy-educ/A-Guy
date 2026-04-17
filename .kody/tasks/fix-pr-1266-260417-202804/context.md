
### plan (2026-04-17T20:29:48)
The plan is ready for your review. The fix is a single comment addition — `AdvancedContentEditor` not having access is correct by design (they're exercise editors, not course managers), but a comment makes that explicit to future readers.

### build (2026-04-17T20:34:18)
Typecheck passes with no errors. The change is minimal — a single descriptive comment added at `src/server/payload/collections/CourseInstructors.ts:98-99`. No other files are affected, no runtime behavior changes, and no browser verification is needed (this is a server-side Payload CMS collection config file, not a UI component).

**Summary of the fix:**
- Added an explanatory comment above the `return false` in the `read` access function of the `CourseInstructors` collection
- The comment expli
...(truncated)
