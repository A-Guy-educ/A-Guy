# Task

## Issue Title

Bug Report: Media Upload Failure in Course/Lesson/Exercise
# 🐞 Bug Report

## 1. Title
Bug Report: Media Upload Failure in Course/Lesson/Exercise

## 2. Environment
- Environment: dev
- User Role / Tenant: Admin 

## 3. Preconditions
Pre-conditions (What must exist for the bug to occur)

User Role: User must be logged in with Admin or Editor privileges to access the Payload CMS admin panel.

Environment: The application must be running (local dev or production) with a configured storage backend (e.g., Vercel Blob or local storage).

Collection Access: The user must have permission to create or edit documents in the 

## 4. Steps to Reproduce
Steps to Reproduce

Log in to the Admin Dashboard (e.g., /admin).

Navigate to either Courses, Lessons, or Exercises collection.

Open an existing item or click "Create New".

Locate a media upload field or a block that accepts media (e.g., a MediaBlock or an exercise attachment field).

Click the upload area or drag-and-drop a file (any type: .jpg, .png, .mp4, etc.).

Observe the network request and the UI behavior.

## 5. Expected Result
The file should upload successfully to the server/cloud storage.

A new document should be created in the Media collection.

The media should be previewed or correctly linked within the parent document (Course/Lesson/Exercise).

The document should save without errors.

## 6. Actual Result
The system returns a 400 Bad Request error in the browser network console.

The upload fails immediately or hangs at 0%.

No media document is created in the database.

An error message appears (or the field remains empty), and the parent document cannot be saved with the intended media.


## 7. Reproducibility
always
