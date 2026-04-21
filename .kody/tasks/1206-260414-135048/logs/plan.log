## Implementation Complete ✓

All **19 auth middleware tests pass**. The implementation is complete:

### Changes Summary

| File | Status |
|------|--------|
| `middleware.ts` | Auth guard added with `isProtectedLearningPath()` and `hasAuthToken()` functions |
| `tests/int/auth-middleware.int.spec.ts` | 19 tests covering protected routes, public routes, and edge cases |

### Behavior

**Public routes (no login required):**
- `/` - Landing page ✓
- `/courses` - Course catalog ✓

**Protected routes (redirect to `/login?returnTo=<path>`):**
- `/study` ✓
- `/practice` ✓
- `/test` ✓
- `/ask` ✓
- `/courses/[slug]` - Individual course pages ✓
- `/courses/.../lessons/...` - All lesson routes ✓

### Test Results
```
✓ tests/int/auth-middleware.int.spec.ts (19 tests) 15ms
```

The login/signup pages already handle the `returnTo` query parameter correctly, so users are redirected back to their original destination after authentication.
