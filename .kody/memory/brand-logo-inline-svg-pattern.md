---
name: brand-logo-inline-svg-pattern
title: Brand Logo Inline Svg Pattern
type: decision
source: task:1578
recorded_at: 2026-05-23T18:09:44Z
---

When extending Brand with a Logo component, render the SVG inline in a React component (not next/image) so it accepts className/fill props from callers. This enables the consumer BrandLogo wrapper to pass through className cleanly.

Why: The old TelescopeLogo used next/image with a raw .svg file, which doesn't support prop passthrough. The new Logo.tsx in the brand bundle renders inline SVG JSX.
How to apply: When adding brand components (e.g., icons, favicons), prefer inline JSX over file-based assets when the component needs to accept props.

**Why:** Inline SVG components can accept className and other React SVG props; raw file imports via next/image cannot.

**Source task:** `1578`
