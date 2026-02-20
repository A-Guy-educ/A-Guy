# Task

## Description
A debug `console.log('data:', data)` statement was left in the Chapters collection `beforeChange` hook. This logs the full chapter data to stdout on every chapter create/update operation in production.

## Files Affected
- `src/server/payload/collections/Chapters.ts` — line 26

## Expected Fix
Remove the `console.log('data:', data)` line.

## Steps to Test
1. Open Payload admin → Chapters → create or edit a chapter
2. Check server terminal output
3. Before fix: full chapter data object logged to stdout
4. After fix: no debug output

## Priority
LOW — Debug log in production, not user-facing but pollutes server logs
