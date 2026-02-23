# Implementation Plan

## Step 1: Generate Payload Types
Run `pnpm generate:types` to regenerate Payload types from the collection schemas.

## Step 2: Verify GuestSessions Configuration
Check that:
- GuestSessions collection is properly exported from collections
- GuestSessions is included in the collections array in payload.config.ts

## Step 3: Remove Type Casts
Replace `as any` with proper types for these operations:
- Line 149: Payload operation on 'guest-sessions'
- Line 173: Payload operation on 'guest-sessions'
- Line 197: Payload operation on 'guest-sessions'
- Line 218: Payload operation on 'guest-sessions'
- Line 236: Payload operation on 'guest-sessions'
- Line 262: Payload operation on 'guest-sessions'
- Line 283: Payload operation on 'guest-sessions'

## Step 4: Verify
Run `pnpm tsc --noEmit` to ensure no type errors.
