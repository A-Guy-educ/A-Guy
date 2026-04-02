
### taskify (2026-04-02T11:06:59)
```json
{
  "task_type": "bugfix",
  "title": "Fix XSS vulnerability in FormulaSheetContent via unsafe HTML rendering",
  "description": "Replace unsanitized dangerouslySetInnerHTML in FormulaSheetContent.tsx with the existing SafeHtml component (using DOMPurify) to prevent stored XSS attacks when admin users or attackers inject malicious HTML into formula sheet HTML blocks. This is a security-critical fix that impacts all students viewing formula sheets.",
  "scope": [
    "src/ui/web/shared/Fo
...(truncated)

### build (2026-04-02T11:08:10)
TypeScript passes. The fix replaces the unsafe `dangerouslySetInnerHTML={{ __html: block.html }}` with `<SafeHtml html={block.html} />`, which sanitizes the HTML through DOMPurify before rendering — eliminating the stored XSS vulnerability.

