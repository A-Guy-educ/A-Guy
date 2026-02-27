# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | fix_bug |
| **Confidence** | 0.85 |
| **Scope** | `src/ui/web/SafeHtml/index.tsx`, `src/ui/web/exerciserenderer/blocks/SvgRenderer/index.tsx`, `src/ui/web/exerciserenderer/utils/svgSanitize.ts`, `src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx`, `src/server/payload/blocks/HtmlBlock/config.ts` |

### Task Summary
> Bug Report: HTML & SVG Content Rendering Failure

### Assumptions
- The HTML sanitizer is stripping <style> tags and inline CSS needed for CSS animations
- The SVG sanitizer is too restrictive and removing animation elements like <animate> and gradients
- The HtmlBlockRenderer may not properly handle or preserve CSS from the HTML content
- The SvgRenderer may not support advanced SVG features like gradients and animations

---

Reply with `@cody approve` or `/cody approve` to proceed.
Reply with `@cody reject` or `/cody reject` to cancel.
