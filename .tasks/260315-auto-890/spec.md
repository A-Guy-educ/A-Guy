# Spec: 260315-auto-890

## Overview

Student Statistics Dashboard - A comprehensive, visual dashboard for students to track their learning progress, view statistics by category, see topic mastery breakdowns, and monitor their daily learning streaks.

## Requirements

### FR-001: Dashboard Entry Points

**Priority**: MUST
**Description**: Dashboard must be accessible via two entry points:
- Course Page: "View Full Statistics" button (Hebrew: "צפה בסטטיסטיקה מלאה") near the course progress overview. Clicking defaults the dashboard to that specific course context.
- User Profile: "My Progress & Stats" link in user account area. Clicking defaults to "All Time / All Courses" overview.

**Implementation Note**: A "statsAndPerformance" button already exists in CoursePageContent component at line 82-85. This button should be updated to navigate to the new statistics dashboard with course context.

### FR-002: Dashboard Controls

**Priority**: MUST
**Description**: 
- Course Filter: Dropdown to switch between "General Overview" (all courses) or specific enrolled courses.
- Timeframe Filter: Toggle to scope data by "This Week", "This Month", or "Overall".

### FR-003: High-Level Summary Cards

**Priority**: MUST
**Description**: Four summary cards displaying:
- Total Progress: Percentage of course completion
- Time Spent: Total site residency (time website is open and active). Timer must pause when user switches to different browser tab.
- Average Score: Mean score across all validated exercises
- Daily Streak: Current consecutive days of activity (counts if user spends cumulative 5 minutes active on site, or 3 active minutes on a specific lesson)

### FR-004: Progress by Category Visualization

**Priority**: MUST
**Description**: Display metrics using exact HSL color values from existing TAB_COLORS constant in CourseTabs component:
- Study/Learning (Blue `hsl(217 91% 60%)`): Number of lessons completed
- Practice (Red `hsl(0 72% 51%)`): Number of exercises attempted vs. successful
- Test/Exams (Pink `hsl(330 81% 60%)`): Historical scores and completion rates for full exams
- Ask (Green `hsl(142 71% 45%)`): Number of questions asked via AI interface and total conversations initiated

**Implementation Note**: The TAB_COLORS constant is already defined in `src/app/(frontend)/courses/[courseSlug]/_components/CourseTabs/index.tsx` and MUST be reused.

### FR-005: Topic Mastery Breakdown

**Priority**: MUST
**Description**: Display success rates by chapter/topic (e.g., "Algebra: 85%", "Geometry: 40%"). Formula to be defined during implementation.

### FR-006: Sequential Gap-Filling Drill-Down

**Priority**: MUST
**Description**: Clicking on a low topic score presents recommendations in priority order:
1. First Incomplete: Suggest the first lesson in that chapter that isn't marked "Completed"
2. Weakest Practice: If all lessons done, suggest practice session for sub-topic with lowest success rate
3. Summary: If chapter is 100% finished, suggest "Chapter Summary" or "Review" lesson

### FR-007: Recent Activity Timeline

**Priority**: MUST
**Description**: Display chronological list of user's last 10 actions (e.g., "Completed Lesson 3", "Redeemed School Code", "Asked a question about Triangles")

### FR-008: Time Tracking with Heartbeat

**Priority**: MUST
**Description**: Implement heartbeat mechanism in a client-side provider or App wrapper. Every 30-60 seconds of active browser time, call POST /api/stats/heartbeat to increment total_time_spent in database. Timer must pause when user switches to different browser tab using visibilitychange API.

### FR-009: Streak Calculation

**Priority**: MUST
**Description**: 
- Use setInterval or setTimeout in main App wrapper or client provider
- Trigger POST /api/stats/streak API call once 5-minute threshold is met in a single day
- Within specific lesson, activity triggered if user stays on page > 3 minutes
- Store streak data in UserProgress collection

### FR-010: Dashboard API Endpoints

**Priority**: MUST
**Description**: Create API endpoints for:
- GET /api/stats/dashboard - Fetch dashboard data with course and timeframe filters
- POST /api/stats/heartbeat - Update time spent (called every 30-60 seconds)
- POST /api/stats/streak - Update daily streak
- GET /api/stats/activity - Fetch recent activity timeline

### FR-011: Activity Logging

**Priority**: MUST
**Description**: Implement activity logging to track user actions for Recent Activity Timeline. Actions to track include: lesson completion, exercise attempts, question asked via AI, school code redemption.

### FR-012: Translation Keys

**Priority**: MUST
**Description**: Ensure all dashboard labels have translation keys in both en.json and he.json files. Existing keys to reference: "statsAndPerformance", "viewStats".

## Acceptance Criteria

- [ ] Dashboard is accessible via Course Page ("View Full Statistics") and User Profile ("My Progress & Stats")
- [ ] Course and Timeframe filters accurately update the displayed data
- [ ] Total Progress, Time Spent, Average Score, and Daily Streak display correctly
- [ ] Daily streak increments when a user spends 5 total active minutes on the site, or 3 active minutes on a specific lesson
- [ ] Active time tracking properly pauses when the user switches away from the browser tab
- [ ] Progress by category uses the exact specified HSL color values (reuse TAB_COLORS)
- [ ] Clicking a low score in Topic Mastery follows the Sequential Gap-Filling logic (Incomplete Lesson -> Weakest Sub-topic -> Summary)
- [ ] Recent Activity displays the last 10 relevant user actions chronologically
- [ ] Dashboard follows Assistant font family (weights 300-800) and card-based layout

## Guardrails

- MUST use existing TAB_COLORS from CourseTabs component (already defined with exact HSL values)
- MUST use existing UserProgress collection schema for progress tracking
- MUST use existing Conversations collection for Ask metrics
- MUST implement authentication check on all API endpoints
- MUST follow existing card-based layout patterns from Design System
- MUST use existing SystemLink component for navigation
- MUST reuse existing translations in src/i18n/en.json and src/i18n/he.json

## Out of Scope

- Exact Topic Mastery calculation formula (pending Product definition)
- Notifications or alerts based on statistics
- Export functionality for statistics
- Social sharing of progress
- Gamification elements beyond streak tracking
