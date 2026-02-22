# Transaction Safety Fix for Guest Session Services

## Overview
Fix critical transaction safety issues in guest session services where Payload operations lack `req` parameter, causing potential data integrity issues.

## Problem Statement
Both `guest-session.ts` and `guest-session-upgrade.ts` use standalone Payload instances via `getPayload({ config })`. All CRUD operations run outside any request transaction.

The `claimGuestConversations` function in `guest-session-upgrade.ts` claims atomicity but uses a for-loop without `req` — if one update fails mid-loop, partial transfer results.

## Requirements

### FR-1: Add req parameter to guest-session.ts functions
All Payload operations in `guest-session.ts` (lines 148, 172, 196, 217, 235, 261, 282) must accept and pass `req` parameter for transaction safety.

### FR-2: Add req parameter to guest-session-upgrade.ts functions  
All Payload operations in `guest-session-upgrade.ts` (lines 38, 54, 81) must accept and pass `req` parameter for transaction safety.

### FR-3: Ensure transaction atomicity in claimGuestConversations
The `claimGuestConversations` function must use `req` for all operations to ensure all conversations transfer or none transfer on failure.

## Acceptance Criteria

- [ ] All Payload operations in guest-session.ts pass `req` parameter
- [ ] All Payload operations in guest-session-upgrade.ts pass `req` parameter  
- [ ] claimGuestConversations maintains atomicity (all or nothing)
- [ ] TypeScript compiles without errors
- [ ] No runtime errors from missing req handling
