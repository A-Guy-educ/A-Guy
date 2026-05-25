# Bug #1953 Fix: Duplicate Lesson Labels in Practice Page

## What was fixed

The Practice page showed duplicate lesson labels in Chapter 2 (e.g., Lesson 4 appeared twice instead of Lesson 4, 5, 6, 7).

## Root Cause

When `chapters` array contained duplicate chapter entries (same chapter ID appearing multiple times), the `lessonsByChapter` lookup would return the same lessons array for each duplicate chapter entry. This caused `filteredLessons` to contain duplicate lessons, which then received duplicate sequential labels in `StudyContent`.

## Changes Made

1. **`src/app/api/chapters/by-grade/route.ts`**: Added deduplication of chapters by ID before processing lessons. Changed `chapters.map(...)` to `uniqueChapters.map(...)` when building `chaptersWithLessons`.

2. **`src/server/repos/queries/study-page.ts`**: Same fix - deduplicate chapters before processing. Also changed `chapters.map(...)` to `uniqueChapters.map(...)`.

3. **`tests/int/practice-duplicate-lesson-labels-1953.int.spec.ts`**: New integration test verifying lesson ID uniqueness and correct sequential label assignment.

## How it works

The fix filters chapters through a `Set` keyed by chapter ID, preserving only the first occurrence of each chapter. This ensures lessons are only attached once per unique chapter, preventing duplicate lessons from propagating to the frontend.
