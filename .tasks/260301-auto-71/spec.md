# Bug Report: Media Upload Failure in Course/Lesson/Exercise

## Overview
Media uploads are failing with a 400 Bad Request error when trying to upload media through Courses, Lessons, or Exercises collections in the Payload CMS admin panel.

## Environment
- **Environment**: dev
- **User Role**: Admin or Editor
- **Storage**: Configured storage backend (e.g., Vercel Blob or local storage)

## Preconditions
1. User logged in with Admin or Editor privileges
2. Application running with configured storage backend
3. User has permission to create/edit documents in Courses, Lessons, or Exercises

## Steps to Reproduce
1. Log in to the Admin Dashboard (/admin)
2. Navigate to Courses, Lessons, or Exercises collection
3. Open an existing item or click "Create New"
4. Locate a media upload field or MediaBlock
5. Click upload area or drag-and-drop a file (.jpg, .png, .mp4, etc.)
6. Observe network request and UI behavior

## Expected Result
- File uploads successfully to server/cloud storage
- New document created in Media collection
- Media correctly linked within parent document (Course/Lesson/Exercise)
- Document saves without errors

## Actual Result
- 400 Bad Request error in browser network console
- Upload fails immediately or hangs at 0%
- No media document created in database
- Error message appears or field remains empty
- Parent document cannot be saved with intended media

## Reproducibility
- Always (100%)

## Affected Collections
- Courses
- Lessons
- Exercises

## Acceptance Criteria
- [ ] Media uploads successfully through Courses collection
- [ ] Media uploads successfully through Lessons collection  
- [ ] Media uploads successfully through Exercises collection
- [ ] Uploaded media is previewed correctly in admin panel
- [ ] Parent documents save successfully with media attachments
- [ ] No 400 Bad Request errors during upload process
