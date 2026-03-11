# Spec: Published Content Display Bug Fix

## Overview

Fix the issue where correctly "Published" Courses, Lessons, and Exercises are missing from the live application. Ensure published content is displayed based on user enrollment status.

## Requirements

1. **Course Visibility**: All Courses marked as "Published" in the Admin system must be visible and accessible on the live application.

2. **Content Access (Lessons & Exercises)**: Users must be able to view the "Published" Lessons and Exercises specifically associated with the course they are registered for.

3. **Current State Resolution**: Resolve the issue where correctly published Courses, Lessons, and Exercises are entirely missing from the live application.

## Acceptance Criteria

- [ ] Verify that a Course marked as "Published" in the Admin appears on the live site.
- [ ] Verify that a user registered to a Course can view its associated "Published" Lessons and Exercises.
- [ ] Verify that Draft/Unpublished content remains hidden from the live site.
- [ ] Ensure that a user *cannot* access Lessons and Exercises of a Course they are *not* registered for, even if the content is "Published".

## Context

- Technical note: Content is confirmed to be in 'publish' state in the admin (CMS state flags)
- Issue is about internal CMS state not being properly reflected in live application display
