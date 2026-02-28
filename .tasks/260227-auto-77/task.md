# Task

## Issue Title

Bug Report: HTML & SVG Content Rendering Failure
זה יותר טוב?
:ladybug: Bug Report: HTML & SVG Content Rendering Failure
1. Title
[Content Rendering] HTML and SVG content in exercises/lessons displays plain text only or fails to render styles/animations
2. Environment
Environment: dev / preview / prod
Browser / Device: All Browsers (Chrome/Safari/Firefox) / Desktop & Mobile
User Role: Admin (Creator) / Student (Viewer)
3. Preconditions
User is logged into the system.
A Course, Lesson, or Exercise exists.
The HTML source or SvgBlock feature is enabled in the CMS.
Admin has permissions to upload or edit content source.
4. Steps to Reproduce
Navigate to the Admin Panel.
Open an existing Lesson or create a new Exercise.
For HTML: Add an HtmlBlock or set the Html source for a lesson. Enter code containing internal CSS <style>, inline styles, or CSS animations (e.g., keyframes).
For SVG: Add an SvgBlock or upload an .svg file. Ensure the SVG contains paths, gradients, or animations.
Save the changes.
Switch to the Frontend application and view the specific lesson or exercise.
5. Expected Result
HTML: The content should render as a complete “HTML Compiler,” reflecting all CSS rules, layouts, and animations.
SVG: The graphic should be fully visible, preserving all vector paths, colors, and internal animations.
6. Actual Result
HTML: The page displays only the raw text content. All CSS styling, positioning, and “moving” elements are stripped away.
SVG: The image is either not displayed, appears broken, or is rendered without its complex properties (animations/gradients).
7. Scope & Impact
Affects: All users (Students cannot view rich or interactive educational content).
Blocking? Yes (Critical for technical and interactive course materials).
Regression? No.
8. Suspected Area
• Sanitization Logic: src/ui/web/SafeHtml/index.tsx — Likely stripping <style>, <animate>, and specific attributes during the sanitization process.
• SVG Components: * src/ui/web/exerciserenderer/blocks/SvgRenderer/index.tsx
src/ui/web/exerciserenderer/utils/svgSanitize.ts — The custom sanitizer might be too restrictive for advanced SVG features.
• Renderers: * src/ui/web/exerciserenderer/blocks/HtmlBlockRenderer/index.tsx
• Server Config: src/server/payload/blocks/HtmlBlock/config.ts.
9. Reproducibility
Always
