# Lesson Order Display Bug - Specification

## Overview
Fix the bug where lesson order defined in the admin panel is not reflected on the website.

## Requirements

### FR-1: Lesson Ordering
- Lessons must be displayed on the website in the order defined in the admin panel
- The order/number field set in the admin must be respected when querying lessons

### FR-2: Admin Order Field
- Admin panel must have an order/number field for each lesson
- This field must be savable and persist correctly

## Acceptance Criteria

- [ ] When lessons are set with specific order in admin, they display in that same order on website
- [ ] The sorting is applied when fetching lessons for display (not just in admin)
- [ ] This works for all lessons across different courses/exams

## Steps to Reproduce (from bug report)

1. Go to the Admin panel
2. Open the lessons management section
3. Set a specific order/number for the lessons
4. Save the changes
5. Open the lessons section on the website (for example: exam 471)
6. Observe the lesson order

## Expected vs Actual

- **Expected**: Lessons should be displayed according to the order defined in the admin panel
- **Actual**: The lessons on the website are not displayed according to the defined order in the admin
