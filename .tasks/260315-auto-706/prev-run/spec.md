# Content Status Labels - Specification

## Overview

Add status labels ("Soon" and "Just Added") to Courses and Lessons to help admins visually highlight new additions and upcoming material, improving student engagement and managing content expectations.

---

## Requirements

### FR-1: Status Labels System

Implement a content status system with two label types:

1. **"Soon" (בקרוב)** Tag
   - Purpose: Build anticipation for upcoming content
   - Visual: Neutral/secondary color (Gray or Light Blue)
   - Behavior: Content is locked; clicking shows message "This content is being prepared and will be available soon"
   - Admin can toggle visibility of "Soon" content

2. **"Just Added" (חדש)** Tag
   - Purpose: Draw attention to fresh material
   - Visual: High-energy color (Bright Green or Yellow)
   - Behavior: Fully accessible, badge only
   - Optional: Auto-expiry with "New Until" date

### FR-2: Admin Interface

In Payload CMS edit view for Courses and Lessons:

- **Status Selector**: Dropdown/radio with options: None (Default), Soon, Just Added
- **Visibility Toggle**: Show/hide "Soon" content from students
- **New Until Date**: Optional date picker for auto-expiry (for "Just Added")

### FR-3: UI/UX Design

- **Badge Style**: Pill-shaped tags with `rounded-full`
- **Placement**: 
  - Course Grid: Top right or top left corner
  - Lesson List: Next to lesson title or progress circle
- **Typography**: Assistant Bold, text-xs
- **Animation**: "Just Added" badges should have subtle pulse animation

---

## Acceptance Criteria

1. Admins can mark a lesson as "Soon" in Payload CMS
2. Students cannot access "Soon" content - clicking shows message instead
3. "Just Added" badge appears on course/lesson cards when enabled
4. Badge adapts to responsive design (mobile/desktop) without overlapping titles
5. Status fields are properly added to both Courses and Lessons collections
6. Access control properly restricts "Soon" content from students
7. Optional: "New Until" date auto-removes "Just Added" badge

---

## Technical Notes

- Modify existing Courses and Lessons collections in Payload
- Add new fields: `contentStatus`, `contentStatusVisible`, `newUntil`
- Create reusable Badge component(s) for both status types
- Update access control functions for courses and lessons
- Use existing design system patterns from the codebase
