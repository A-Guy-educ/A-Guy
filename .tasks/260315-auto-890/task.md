# Task

## Issue Title

[P3] Student Statistics Dashboard
### 1. Refined Product Specification

**Feature:** Student Statistics Dashboard
**Goal:** Provide students with a comprehensive, visual dashboard of their learning progress, highlighting strengths, identifying areas for improvement, and tracking engagement.

**Access & Entry Points**
*   **Course Page:** A primary button labeled "View Full Statistics" (Hebrew: "צפה בסטטיסטיקה מלאה") displayed near the course progress overview. Navigating from here defaults the dashboard to the specific course context.
*   **User Profile:** A link labeled "My Progress & Stats" located in the user account/profile area. Navigating from here defaults the dashboard to a global "All Time / All Courses" overview.

**Dashboard Controls**
*   **Course Filter:** A dropdown allowing the user to switch between a "General Overview" (all courses) or specific enrolled courses.
*   **Timeframe Filter:** A toggle to scope data by "This Week", "This Month", or "Overall".

**Dashboard Sections & Metrics**
1.  **High-Level Summary Cards**
    *   **Total Progress:** Percentage of course completion.
    *   **Time Spent:** Total site residency. The total time the user has the website open and active in their browser across all pages. The timer must pause if the user switches to a different browser tab.
    *   **Average Score:** Mean score across all validated exercises.
    *   **Daily Streak:** Current consecutive days of activity. A day counts toward the streak if the user spends a cumulative 5 minutes active on the website. Within a specific lesson, activity is triggered if the user stays on the page for more than 3 minutes.
2.  **Progress by Category** (Must strictly adhere to dynamic theme mapping)
    *   **Study / Learning (Blue `hsl(217 91% 60%)`):** Number of lessons completed.
    *   **Practice (Red `hsl(0 72% 51%)`):** Number of exercises attempted vs. successful.
    *   **Test / Exams (Pink `hsl(330 81% 60%)`):** Historical scores and completion rates for full exams.
    *   **Ask (Green `hsl(142 71% 45%)`):** Number of questions asked via the AI interface and total conversations initiated.
3.  **Performance Breakdown**
    *   **Topic Mastery:** Success rates displayed by chapter/topic (e.g., "Algebra: 85%", "Geometry: 40%"). *(Note: Exact formula for this calculation is pending Product definition).*
    *   **Actionable Drill-Down (Sequential Gap-Filling):** Clicking on a low topic score presents targeted recommendations in the following priority:
        1. *First Incomplete:* Suggest the very first lesson in that chapter that isn't marked "Completed."
        2. *Weakest Practice:* If all lessons are done, suggest the practice session for the sub-topic with the lowest success rate.
        3. *Summary:* If the chapter is 100% finished, suggest the "Chapter Summary" or "Review" lesson.
    *   **Recent Activity Timeline:** A chronological list of the user's last 10 actions (e.g., "Completed Lesson 3", "Redeemed School Code", "Asked a question about Triangles").

**Design & UI Constraints**
*   **Typography:** Assistant font family (weights 300-800).
*   **Layout:** Clean, responsive, card-based layout aligning with the established Design System.
*   **Color Palette:** Must utilize the exact defined system color mapping (Blue, Red, Pink, Green) for category visualizations.

---

### Acceptance Criteria
- [ ] Dashboard is accessible via the Course Page ("View Full Statistics") and User Profile ("My Progress & Stats").
- [ ] Course and Timeframe filters accurately update the displayed data.
- [ ] Total Progress, Time Spent, Average Score, and Daily Streak display correctly.
- [ ] Daily streak increments when a user spends 5 total active minutes on the site, or 3 active minutes on a specific lesson.
- [ ] Active time tracking properly pauses when the user switches away from the browser tab.
- [ ] Progress by category uses the exact specified HSL color values.
- [ ] Clicking a low score in Topic Mastery follows the Sequential Gap-Filling logic (Incomplete Lesson -> Weakest Sub-topic -> Summary).
- [ ] Recent Activity displays the last 10 relevant user actions chronologically.

---

### Context (Extracted Technical / Implementation Details)
*The following items were extracted from the requirements as they relate to implementation details, system architecture, or internal constraints rather than user-facing behavior:*

*   **Database/State:** "The system must have existing UserProgress records and Ask conversation history for the student." / "Authentication: The user must be logged in."
*   **Colors:** "These are hardcoded in both NavigationBar and CourseTabs/TAB_COLORS..."
*   **Time Tracking Implementation:** "Implementation: Use a 'Heartbeat' approach. Every 30–60 seconds of active browser time, increment the total_time_spent in the database." / "Note: The developer should ensure the timer pauses if the user switches to a different browser tab (using the `visibilitychange` API) to keep the data honest."
*   **Streak Implementation:** "Developer Tip: They should use a simple `setInterval` or a `setTimeout` in the main App wrapper that triggers a 'Streak Updated' API call once the 5-minute threshold is met in a single day."
