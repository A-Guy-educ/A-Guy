# fix: Course collection admin list view should show course status and chapter count

## Description
The Courses collection in the admin panel (`/admin/collections/courses`) shows a basic list of courses but is missing useful columns. Add the following to the admin list view:

## Acceptance Criteria
- [ ] Add a `status` column to the courses admin list view (draft/published)
- [ ] Add a `chapters` count column showing how many chapters each course has
- [ ] Verify the changes render correctly by navigating to `/admin/collections/courses` in the browser

## Visual Verification Required
1. Log in at `/login` using the admin test account
2. Navigate to `/admin/collections/courses`
3. Verify the new columns appear in the list view
4. Confirm data displays correctly for existing courses