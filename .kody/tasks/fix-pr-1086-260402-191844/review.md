## Review: FAIL

### Major Issues

1. **Incomplete order persistence** (`CourseLessonsSorter/index.tsx:176-196`): When moving a lesson, only the moved lesson's `order` is saved to the database. The displaced lesson retains its old order value. After page refresh, two lessons can share the same `order`, causing unpredictable sorting. Both affected lessons (or all lessons in the chapter) need their orders updated.

2. **Error details leak** (`api/lessons/[id]/route.ts:106-113`): The 500 response returns `error.message` in `details`, which can expose internal paths or database errors to clients.

### Minor Issues

- Entire component uses inline `style={{}}` instead of Tailwind classes / design system tokens
- Mutation inside `forEach` instead of immutable `map`
- `any[]` type for user roles instead of proper typing

### Placement Fix Looks Correct

The `lessonsSorter` UI field is now positioned after `isActive` in the main content area — this should render visibly near the top of the course edit form.
