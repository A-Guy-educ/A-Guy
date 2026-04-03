# fix: Admin dashboard header should display current user email

## Description
The admin panel header at `/admin` does not display the currently logged-in user's email. Add the logged-in user's email to the admin header.

## Acceptance Criteria
- [ ] Show the current admin user's email in the admin panel header/nav area
- [ ] The email should be visible on all admin pages

## Visual Verification Required
1. Log in at `/login` using admin credentials
2. Navigate to `/admin`
3. Verify the admin email is displayed in the header
4. Navigate to `/admin/collections/courses` and verify it persists