# Logo Component Bug Fix - Specification

## Overview

Fix the Logo component in `src/ui/web/Logo/Logo.tsx` to display proper A-Guy/Telescope branding instead of the default Payload CMS logo.

## Current Behavior

- Logo displays the Payload CMS default logo from GitHub
- Alt text says "Payload Logo"
- Image loaded from `raw.githubusercontent.com/payloadcms/payload/main/...`

## Expected Behavior

- Logo should display the A-Guy/Telescope branding using the existing `TelescopeLogo` component
- Alt text should say "A-Guy" or reflect the project name
- Image should reference a local project asset (TelescopeLogo component)

## Requirements

- FR-1: Replace the current image-based logo with the `TelescopeLogo` component from `@/ui/web/TelescopeLogo`
- FR-2: Update the component to properly import and render the TelescopeLogo
- FR-3: Ensure proper props are passed (e.g., className for styling)

## Acceptance Criteria

- [ ] Logo.tsx imports TelescopeLogo from @/ui/web/TelescopeLogo
- [ ] Logo.tsx renders TelescopeLogo component instead of img tag
- [ ] No references to Payload logo or raw.githubusercontent.com remain
- [ ] Component still accepts and passes through className prop for styling flexibility
