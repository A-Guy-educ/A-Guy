# Task

## Issue Title

[P1] Published Content from Admin Not Displaying on Live Application
### Mode
full

### Priority
P1

### Description
**Goal:** Ensure "Published" content from the Admin system is accurately displayed to users on the live application based on their enrollment status.

**Core Behaviors & Requirements:**
*   **Course Visibility:** All Courses marked as "Published" in the Admin system must be visible and accessible on the live application. 
*   **Content Access (Lessons & Exercises):** Users must be able to view the "Published" Lessons and Exercises specifically associated with the course they are registered for.
*   **Current State Resolution:** Resolve the issue where correctly published Courses, Lessons, and Exercises are entirely missing from the live application.

### Acceptance Criteria
- [ ] Verify that a Course marked as "Published" in the Admin appears on the live site.
- [ ] Verify that a user registered to a Course can view its associated "Published" Lessons and Exercises.
- [ ] Verify that Draft/Unpublished content remains hidden from the live site.
- [ ] Ensure that a user *cannot* access Lessons and Exercises of a Course they are *not* registered for, even if the content is "Published".

### Context
*   *Extracted Technical Statement:* "I checked it is in 'publish' in the admin"
*   *Why it is considered technical:* Refers to internal CMS state flags rather than the end-user experience, though it's crucial context for the engineering team to know the data is correctly flagged in the database.
