# Spec: Stage 2 - Standardize PDF Conversion in Payload Admin UI

## Document Control

- Date: 2026-02-06
- Owner: Product + Engineering
- Status: Draft for implementation
- Stage: 2 of 3

## Goal

Deliver PDF conversion as a standard Payload Admin experience with clear navigation, predictable routing, and consistent in-page actions and status feedback.

## Locked Decisions

1. Conversion page must render inside the standard Payload Admin shell.
2. Navigation entry must be clear and reachable via one obvious path.
3. Custom shell patterns are out; Payload-native layout is required.

## Requirements

### Functional Requirements

- FR-U1: Conversion page renders inside default Payload header and sidebar shell.
- FR-U2: Navigation link label is clear and concise.
- FR-U3: Route is predictable and clean (resource-based pathing; minimal noisy params).
- FR-U4: Primary conversion actions and statuses follow standard admin interaction patterns.

### UX Requirements

- UX-U1: User reaches conversion page from one obvious entry point.
- UX-U2: Page title, breadcrumbs, and primary action are immediately understandable.
- UX-U3: Success and error states are visible in-page without custom shells.

## HLS (Target Flow for Stage 2)

1. User opens conversion page from standard admin navigation.
2. Page renders in Payload shell with standard layout semantics.
3. User runs core conversion action from primary CTA.
4. Status and feedback are visible in-page using standard admin patterns.

## LLP (Implementation Steps)

1. Register conversion page as a proper Payload Admin view.
2. Place conversion navigation entry in standard admin structure.
3. Normalize route naming, link naming, and page title/breadcrumb semantics.
4. Align action placement and status/feedback rendering with existing admin conventions.

## Security and Access

- Preserve existing authorization checks for all conversion actions.
- No page action may bypass role/access controls.
- Any Local API call with user context must use `overrideAccess: false`.

## Gate

### Gate 2 - Admin UI Standard

- Conversion page is rendered in standard Payload Admin shell.
- Header/sidebar and navigation are consistent with existing admin pages.
- Conversion entry is clean, understandable, and reachable in one clear path.

## Test Plan

- Integration: conversion page loads in standard layout and supports core action flow.
- Regression: route and navigation smoke tests for conversion entry and page load.

## Risks and Mitigations

- Risk R2: Route or navigation regressions during shell standardization.
  - Mitigation: explicit route tests and admin navigation smoke tests.

## Timebox

- 1-2 engineering days.

## Definition of Done

- Gate 2 passes.
- Layout and navigation behavior are validated by tests.
- Conversion operations are accessible only via standard Payload Admin UX.
