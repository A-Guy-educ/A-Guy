# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | implement_feature |
| **Confidence** | 0.95 |
| **Scope** | `TeacherProfiles collection (new)`, `UserSettings.teacherProfile field (modify)`, `Chat orchestrator integration`, `UI for profile selection`, `Data seeding (5 profiles)` |

### Task Summary
> Teacher Profile

### Assumptions
- Prompts collection already exists for systemPrompt relationship
- UserSettings collection exists and can be extended
- Existing chat/orchestrator system exists for integration
- Base system prompt infrastructure exists

### Plan
```
# Plan: Teacher Profile Feature

**Task ID**: 260225-auto-93
**Type**: implement_feature
**Spec**: `.tasks/260225-auto-93/spec.md`

---

## Summary

Implement the Teacher Profile feature that defines the behavioral identity of the AI chat for student-facing requests. This involves:
1. A new `TeacherProfiles` collection
2. A new `UserSettings` collection (1:1 with Users)
3. An `afterChange` hook on Users to auto-create UserSettings on signup
4. A new `resolveTeacherProfile` service function
5. Injection of the teacher profile block into the system prompt composition pipeline
6. A seed function creating 5 Prompt entries + 5 TeacherProfile entries

---

```

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
