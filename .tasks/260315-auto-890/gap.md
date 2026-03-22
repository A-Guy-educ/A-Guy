# Gap Analysis: 260315-auto-890

## Summary

- Gaps Found: 6
- Spec Revised: Yes

## Gaps Found

### Gap 1: Existing Entry Point Already Exists

**Severity:** High
**Location:** `src/app/(frontend)/courses/[courseSlug]/_components/CoursePageContent/index.tsx`, line 82-85
**Issue:** The task spec mentions adding a "View Full Statistics" button, but this button already exists as "statsAndPerformance" in the CoursePageContent component. The spec didn't account for this existing implementation.
**Fix Applied:** Added FR-001 implementation note referencing the existing button that needs to be updated to link to the new dashboard.

### Gap 2: Existing TAB_COLORS Constant

**Severity:** Medium
**Location:** `src/app/(frontend)/courses/[courseSlug]/_components/CourseTabs/index.tsx`, lines 8-13
**Issue:** The task spec defines HSL color values for the four categories, but the codebase already has an exact TAB_COLORS constant that must be reused. The spec didn't mention this existing pattern.
**Fix Applied:** Added FR-004 implementation note requiring reuse of TAB_COLORS constant and added guardrail to use existing TAB_COLORS.

### Gap 3: Missing Time Tracking Implementation Details

**Severity:** High
**Location:** Frontend - requires new component
**Issue:** The spec mentions "heartbeat mechanism" and "visibilitychange API" but doesn't specify where this should be implemented. Need to create a client-side provider or App wrapper component.
**Fix Applied:** Added FR-008 with specific implementation requirements for heartbeat in App wrapper and visibilitychange API handling.

### Gap 4: Missing API Endpoints

**Severity:** High
**Location:** Backend - requires new API routes
**Issue:** The task describes data requirements but doesn't explicitly call out the need for backend API endpoints. Dashboard requires: GET /api/stats/dashboard, POST /api/stats/heartbeat, POST /api/stats/streak, GET /api/stats/activity.
**Fix Applied:** Added FR-010 explicitly listing required API endpoints.

### Gap 5: Missing Activity Logging

**Severity:** Medium
**Location:** Backend/Frontend - requires new functionality
**Issue:** The spec mentions Recent Activity Timeline but doesn't explicitly require activity logging infrastructure. Need to track and store user actions for the timeline.
**Fix Applied:** Added FR-011 for activity logging to track user actions.

### Gap 6: Missing Translation Keys Reference

**Severity:** Low
**Location:** `src/i18n/en.json`, `src/i18n/he.json`
**Issue:** The spec mentions "View Full Statistics" (Hebrew: "צפה בסטטיסטיקה מלאה") but translations already exist for "statsAndPerformance" and "viewStats". Should reference existing translations.
**Fix Applied:** Added FR-012 for translation keys and updated guardrails to reference existing translation files.

## Changes Made to Spec

- Added FR-001: Dashboard Entry Points - with implementation note about existing button
- Added FR-004: Progress by Category Visualization - with note to reuse TAB_COLORS
- Added FR-008: Time Tracking with Heartbeat - specific implementation requirements
- Added FR-010: Dashboard API Endpoints - listed required endpoints
- Added FR-011: Activity Logging - for Recent Activity Timeline
- Added FR-012: Translation Keys - to reference existing translations
- Added Guardrails section - referencing existing TAB_COLORS, UserProgress, Conversations collections, and existing patterns
- Updated Acceptance Criteria - added reference to reusing TAB_COLORS

## No Gaps Found

The initial exploration found that some elements already exist in the codebase:
- "statsAndPerformance" button exists on course page
- TAB_COLORS constant exists with exact HSL values
- Translation keys exist
- UserProgress collection exists
- Conversations collection exists
- Account page structure exists

These were incorporated into the revised spec as mandatory reuse requirements.
