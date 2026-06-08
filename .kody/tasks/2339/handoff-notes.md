Resolved merge conflict in docs/admin-components/README.md.

Conflict was in the component table (lines ~51-68): HEAD (PR #2108) added LessonBlocksField/InlineExerciseEditor components; origin/dev added Coupons components and breadcrumb fields. The dev side had incorrect paths for Coupons components (src/components/admin/Coupons/ instead of src/ui/admin/Coupons/).

Resolution: kept all components from both sides, used correct src/ui/admin/ paths throughout, and preserved HEAD's breadcrumb field paths (src/ui/admin/ChapterBreadcrumbField/ and src/ui/admin/LessonBreadcrumbField/) which are consistent with where actual admin components live — though these breadcrumb components don't appear to exist in the codebase yet.
