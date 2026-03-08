# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | implement_feature |
| **Confidence** | 0.85 |
| **Scope** | `UI components: Equation paper button, sheet/modal component`, `Data integration: Lesson/course formula sheet relationships`, `Content rendering: RichText with LaTeX, PDF viewer`, `State management: Preservation of chat state`, `Responsive behavior: Mobile drawer vs desktop panel` |

### Task Summary
> Equation Paper (דף נוסחאות) - Specification

### Assumptions
- Technical implementation details (schema, component props) will be defined in later stages
- Figma designs will be available for implementation
- Existing MathMarkdown component can be reused for LaTeX rendering
- PDF viewer library already exists or will be selected during implementation

### Review Questions
1. Should the formula sheet use existing modal/sheet components or create new ones?
2. Is there an existing PDF viewer component in the codebase that meets the requirements?
3. What is the preferred approach for the lesson/course data fetching - query parameters or direct payload API?

---

Reply `approve` to proceed.
Reply `reject` to cancel.
