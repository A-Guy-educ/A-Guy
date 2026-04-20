## Summary

**The implementation is already complete.** All three components requested in the PR #1266 comment are already on `origin/1244--featlms-instructor-role-per-course-permissi` at commit `ffe9cfe8`:

| Component | Status | Evidence |
|-----------|--------|----------|
| **API** (`route.ts`) | ✅ Done | Admin fetches all courses + course-instructors, builds `instructorsByCourse` map, returns `courses[].instructors` |
| **UI** (`InstructorDashboardContent.tsx`) | ✅ Done | `isAdmin` branch renders "Course Oversight" heading + `InstructorBadge` per course |
| **Tests** (int + E2E) | ✅ Done | `tests/int/instructor-dashboard.int.spec.ts` + `tests/e2e/lms-instructor-role.e2e.spec.ts` |

The previous Kody review (Apr 18) gave a **PASS** verdict across all quality gates.

### The only remaining issue

**Ship stage crashed** on Apr 19:
```
git push --force -u origin HEAD
 ! [remote rejected] HEAD -> 1244--featlms-instructor-role-per-course-permissi 
   (refusing to allow a GitHub App...)
```

The GitHub App (`Kody`) cannot force-push to branches matching the `1244--*` pattern. The fix commit (`ffe9cfe8`) IS on origin — a **non-force push** should succeed.

### Resolution options

**Option 1 — Retry the pipeline (simplest):**
```
@kody ship
```
Or manually trigger the `kody` workflow from GitHub Actions with `task_id: 2`, `from_stage: ship`.

**Option 2 — Push manually:**
```bash
git fetch origin 1244--featlms-instructor-role-per-course-permissi
git push origin 1244--featlms-instructor-role-per-course-permissi
```

**Option 3 — Merge via GitHub UI:**
Open https://github.com/A-Guy-educ/A-Guy/pull/1266 and click **Merge**.

The plan is written at `.kody/tasks/2/plan.md` with full details.