# [MEDIUM] Enhancement: validateContextAccess is a no-op — always returns true

## Description
The `validateContextAccess` and `validateGuestContextAccess` methods in `ConversationService` always return `true`, meaning any authenticated user (or guest) can chat about any exercise, lesson, or course regardless of enrollment status.

## Files Affected
- `src/server/services/conversation-service.ts` — lines 278-326 (`validateContextAccess`)
- `src/server/services/conversation-service.ts` — lines 332-339 (`validateGuestContextAccess`)

## Current Code
```typescript
// TODO: Implement based on your enrollment model
async validateContextAccess(...): Promise<boolean> {
  if (userRole === AccountRole.Admin) return true
  // TODO: Implement actual enrollment check
  return true // ← Always allows access
}
```

## Expected Implementation
Check if user is enrolled in the course/lesson context:
```typescript
async validateContextAccess(userId, contextType, contextId, userRole) {
  if (userRole === AccountRole.Admin) return true
  
  // Check enrollment
  const enrollment = await this.payload.find({
    collection: 'enrollments',
    where: {
      user: { equals: userId },
      course: { equals: contextId },
      status: { equals: 'active' },
    },
    limit: 1,
  })
  
  return enrollment.totalDocs > 0
}
```

## Priority
MEDIUM — Authorization gap, depends on enrollment model being ready