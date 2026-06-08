## Issue #2248: docs-drift Block Rendering

### What was done
Updated the HTML Block Security Model note in `docs/block-rendering/README.md` (line 60) to accurately reflect PR #2116's changes to HtmlBlock validation.

### What changed
The old note said dangerous patterns (inline event handlers, javascript: URLs) are blocked at admin-input time and implied external/data URLs were also blocked. The new note clarifies:

- Admin input validation only blocks: `<script>`, `<iframe>` and other hazardous tags; inline event handlers (`on*=`); `javascript:` URLs in href/src
- Everything else (style attrs, details/summary, dir, external URLs, data URLs) is now allowed in the admin editor
- Student-facing rendering still uses DOMPurify with a strict allowlist — any unlisted HTML is stripped at render time

### Why the note was wrong
PR #2116 simplified `validate-html.ts` to remove the external URL block, data URL block, mailto/tel/ftp block, and the extensive tag allowlist. The old note's description of what was blocked at admin-input time was stale.

### What was NOT changed
- No code files were modified
- The HtmlBlock table entry (html block type) was already added in the prior chore run on this branch
- HtmlBlockRenderer student-facing DOMPurify config is unchanged
