# Task

## Issue Title

Bug: Logo component displays 'Payload Logo' instead of A-Guy branding
## Description

The `Logo` component in `src/ui/web/Logo/Logo.tsx` still shows the default Payload CMS logo with `alt="Payload Logo"` and loads an SVG from Payload's GitHub repository. This is leftover boilerplate that was never updated to match the A-Guy project branding.

## Current Behavior

- Logo displays the Payload CMS default logo
- Alt text says "Payload Logo"
- Image is loaded from `raw.githubusercontent.com/payloadcms/payload/main/...`

## Expected Behavior

- Logo should display the A-Guy/Telescope branding (the project already has a `TelescopeLogo` component)
- Alt text should say "A-Guy" or the project name
- Image should reference a local or project-appropriate asset

## Files to Change

- `src/ui/web/Logo/Logo.tsx`

## Complexity

Easy — single file change, replace the image source and alt text.

## Labels

bug, good-first-issue
