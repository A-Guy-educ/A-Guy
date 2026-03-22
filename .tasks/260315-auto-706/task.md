# Task

## Issue Title

Content Status Badging ("Soon" & "Just Added")
1. Goal

To increase student engagement and manage content expectations by visually highlighting new additions and upcoming material. This system will allow admins to mark courses or lessons with specific status labels that influence both the design and the accessibility of the content.

2. Status Definitions & Logic

2.1 "Soon" (בקרוב) Tag

Objective: Build anticipation for upcoming content.

Student Experience: * A "Soon" badge appears on the Course/Lesson card.

Access Control: The item is locked. If a student clicks on it, they receive a message: "This content is being prepared and will be available soon," rather than being taken to the lesson/course page.

Visuals: Usually a neutral or secondary color (e.g., Gray or Light Blue) to indicate it is not yet "active."

2.2 "Just Added" (חדש) Tag

Objective: Draw attention to fresh material.

Student Experience: * A "Just Added" or "New" badge appears on the Course/Lesson card.

Access Control: Fully accessible. The badge is purely a visual highlight to help returning students find what's new.

Visuals: High-energy color (e.g., Bright Green or Yellow) to signify activity and freshness.

3. Admin Experience (Payload CMS)

Admins should have a simple way to manage these tags within the existing Courses and Lessons collections.

3.1 Tag Configuration

In the edit view of a Course or Lesson, add a "Content Status" section:

Status Selector (Dropdown/Radio):

None (Default)

Soon

Just Added

Visibility Toggle: The ability to hide "Soon" content entirely from students if the admin isn't ready to show the teaser yet.

3.2 Automated Expiry (Optional Requirement)

Admins should be able to set a "New Until" date for the "Just Added" tag, after which the badge automatically disappears to keep the site looking updated without manual intervention.

4. Design Guidelines (UI/UX)

Badge Style: Small, pills-shaped tags with rounded corners (rounded-full).

Placement: * Course Grid: Top right or top left corner of the course card.

Lesson List: Next to the lesson title or the progress circle.

Typography: Use Assistant Bold, font size should be smaller than the main text (e.g., text-xs).

Animations: "Just Added" badges could have a subtle pulse animation to further draw the eye.

5. Success Criteria

Admins can mark a lesson as "Soon" and verify that students cannot click into it.

A "Just Added" badge appears immediately on the homepage or course list when enabled.

The badges adapt to the responsive design (mobile/desktop) without overlapping critical text like the Course Title.


---
_Created by @korenguy123 via Cody dashboard_
