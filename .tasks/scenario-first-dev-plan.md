# Scenario-First Development: Plan v4

## Core Principle: Design System is Source of Truth

```
HTML Prototype = "Design intent" (suggestion)
Design System = "Source of truth" (authority)

If prototype conflicts with Design System → Design System wins
```

---

## Current Design System Audit

### ✅ Base Components (Complete)

| Component | Status | Variants/Sizes |
|-----------|--------|-----------------|
| Button | ✅ Full | 6 variants, 4 sizes |
| Input | ✅ Complete | All input types |
| Card | ✅ Full | Header, Title, Content, Footer |
| Dialog | ✅ Full | Overlay, Title, Description |
| Select | ✅ Full | Radix-based |
| Toast | ✅ Full | Sonner |
| Label | ✅ | |
| Checkbox | ✅ | |
| Textarea | ✅ | |
| Dropdown | ✅ | |
| Progress | ✅ | |
| Avatar | ✅ | |
| Badge | ✅ | |
| Accordion | ✅ | |
| Sheet | ✅ | |
| Tooltip | ✅ | |

### ✅ Exercise Components (Complete)

| Component | Status |
|-----------|--------|
| McqQuestion | ✅ |
| TrueFalseQuestion | ✅ |
| FreeResponseQuestion | ✅ |
| MatchingQuestion | ✅ |
| TableQuestion | ✅ |
| HelpSystem | ✅ (Hint + Solution) |
| FeedbackDisplay | ✅ |
| QuestionCard | ✅ |
| BlockRenderer | ✅ |

### ⚠️ Design Gaps to Fill

| Gap | Priority | Effort |
|-----|---------|--------|
| Skeleton/Loading | Medium | 1hr |
| EmptyState | Medium | 1hr |
| Alert/Inline Error | Medium | 1hr |
| Tabs | Low | 1hr |

### ✅ Verdict: Good to Start

The existing design system covers:
- Core UI components
- Exercise-specific components
- Typography, icons, utilities

**Gaps will be filled iteratively as scenarios reveal them.**

### Quick Wins (Before Starting)

If starting fresh, add these 3 components first:
1. **Skeleton** - Loading states (Site Behavior)
2. **Alert** - Inline errors (Site Behavior)
3. **EmptyState** - Empty states

---



---

## Overview

Build a system where:

```
Designer → HTML Prototype (suggestion)
                ↓
        Extract selectors, interactions (as reference)
                ↓
        QA writes scenarios using selectors
                ↓
        Site Behavior documents how site handles situations
                ↓
        Fixtures provide test data
                ↓
        Architect TRANSLATES prototype → Design System
                ↓
        Cody implements using Design System components
                ↓
        Tests verify = Design System implementation ✓
```

---

## The Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          DESIGN SYSTEM                            │
│                                                                  │
│  Components: Button, Input, Card, Modal, Toast, etc.            │
│  Tokens: colors, spacing, typography, shadows                    │
│  Patterns: forms, navigation, layouts                          │
│                                                                  │
│  THIS IS THE SOURCE OF TRUTH                                    │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ overrides prototype if conflict
                              │
┌──────────────────────────────┴───────────────────────────────────┐
│                     ARCHITECT AGENT                               │
│                                                                  │
│  Prototype: "blue rounded button with custom onclick"            │
│  Design System: Button component                                │
│                                                                  │
│  Decision: Use Button component, discard prototype button        │
│  Reason: Consistent with design system, tested, accessible       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      IMPLEMENTATION                              │
│                                                                  │
│  Uses: Design System Button                                    │
│  Not: Prototype's custom button                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Five Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     SCENARIO EDITOR                               │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ DESIGN SYS   │  │ PROTOTYPES   │  │ SITE BEHAVIOR│     │
│  │              │  │              │  │              │     │
│  │ Components  │  │ Load HTML   │  │ Loading     │     │
│  │ Tokens      │  │ See elements│  │ Errors      │     │
│  │ Patterns    │  │ Get ref    │  │ Auth        │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ SCENARIOS   │  │ FIXTURES    │  │ PRD         │     │
│  │              │  │              │  │              │     │
│  │ Build steps │  │ User data  │  │ Generate    │     │
│  │ Link DS    │  │ Course data│  │ Preview     │     │
│  │ Link SB    │  │ Exercise  │  │ Create GH   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component 1: DESIGN SYSTEM

### Purpose
The canonical source of truth for all UI implementation.

### What It Provides
| From Design System | What Implementors Get |
|-------------------|---------------------|
| Button component | Variants, sizes, states, accessibility |
| Input component | Validation, styling, error states |
| Card component | Layout, shadows, hover states |
| Toast component | Positioning, animation, auto-dismiss |
| Tokens | Colors, spacing, typography |

### Existing in Project
```typescript
// src/ui/
// ├── components/       # Design system components
// │   ├── Button/
// │   ├── Input/
// │   ├── Card/
// │   ├── Modal/
// │   ├── Toast/
// │   └── ...
// ├── tokens/         # Design tokens
// └── patterns/       # Layout patterns
```

### Role in System
```
Scenario Editor → Architect sees Design System components
                         ↓
                   Maps prototype elements → Design System
                         ↓
                   Implementation uses Design System components
                         ↓
                   Consistent, maintainable UI ✓
```

---

## Component 2: PROTOTYPES

### Purpose
Designer provides an HTML file showing design intent and interaction flow.

### What It Gives Us
| From HTML | What We Get |
|-----------|-------------|
| Structure | DOM hierarchy reference |
| IDs/classes | Selector suggestions |
| Interactions | Behavior hints (onclick, show/hide) |
| Styling | Visual direction |

### What It Does NOT Give Us (Design System Overrides)
| Prototype Has | Design System Provides |
|---------------|----------------------|
| Custom styled button | Button component with variants |
| Custom styled input | Input component with validation |
| Custom styled card | Card component with shadows |
| Custom anything | Respective DS component |

### Files
```
scripts/qa/prototype/
├── loader.ts              # Load HTML file
├── selector-extractor.ts  # Extract selectors as reference
├── interaction-parser.ts  # Parse onclick handlers
└── state-detector.ts     # Detect initial CSS states
```

---

## Component 3: SITE BEHAVIOR

### Purpose
Document how the site handles situations that neither prototype nor design system can express:
- Loading states (skeleton vs spinner)
- Error handling (toast vs modal vs inline)
- Auth flows (session timeout, redirects)
- Animations (timing, easing)
- Responsive behavior

### Schema
```typescript
// scripts/qa/site-behavior/schema.ts

export const LoadingBehaviorSchema = z.object({
  id: z.string(),
  feature: z.string(),
  type: z.literal('loading'),
  initial: z.enum(['skeleton', 'spinner', 'progress']),
  duration: z.number().optional(),
  transition: z.object({
    type: z.enum(['fade', 'slide', 'instant']),
    duration: z.number(),
  }).optional(),
})

export const ErrorBehaviorSchema = z.object({
  id: z.string(),
  feature: z.string(),
  type: z.literal('error'),
  errorType: z.enum(['network', 'auth', 'validation', 'server', 'unknown']),
  display: z.enum(['toast', 'modal', 'inline', 'banner']),
  recoverable: z.boolean(),
  retryable: z.boolean(),
  userInputPreserved: z.boolean(),
})
```

### Files
```
scripts/qa/site-behavior/
├── schema.ts
├── loader.ts
├── validator.ts
└── behaviors/
    ├── loading.json
    ├── errors.json
    ├── auth.json
    ├── animations.json
    └── responsive.json
```

---

## Component 4: FIXTURES

### Purpose
Provide test data that scenarios use.

### Schema
```typescript
export const FixtureSchema = z.object({
  id: z.string(),
  name: z.string(),
  data: z.record(z.unknown()),
})
```

### Files
```
tests/qa/student/fixtures/
├── student-basic.json
├── student-with-course.json
├── exercise-mcq.json
└── exercise-matching.json
```

---

## Component 5: SCENARIOS

### Purpose
Executable specifications that reference design system, prototypes, fixtures, and site behaviors.

### Schema
```typescript
export const StepSchema = z.object({
  type: z.enum(['given', 'when', 'then', 'and', 'but']),
  action: z.string(),
  target: z.string(),           // From prototype as reference
  component: z.string().optional(),  // From Design System (filled by architect)
  input: z.record(z.unknown()).optional(),
}))

export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  storyId: z.string().optional(),
  category: z.enum(['core', 'feature', 'edge']),
  fixture: z.string().optional(),
  prototype: z.string().optional(),
  steps: z.array(StepSchema),
  siteBehaviors: z.array(z.string()).optional(),
  status: z.enum(['draft', 'planned', 'implemented', 'verified']).optional(),
})
```

### Example Scenario
```json
{
  "id": "solve-mcq-with-hint",
  "name": "Solve MCQ with Hint",
  "category": "feature",
  "fixture": "student-with-course",
  "prototype": "exercise-page.html",
  "steps": [
    { "type": "given", "action": "beAt", "target": "exercise-page" },
    { "type": "when", "action": "click", "target": "hint-button", "component": "Button" },
    { "type": "then", "action": "see", "target": "hint-text", "component": "Text" }
  ],
  "siteBehaviors": ["network-error-retry"],
  "status": "implemented"
}
```

---

## Component 6: PRD GENERATOR

### Purpose
Generate GitHub issue from scenario with all context including Design System decisions.

### Output
```markdown
# PRD: {scenario_name}

## Overview

## User Story

## Scenario

## Prototype vs Design System

| Element | Prototype | Design System Decision | Reason |
|---------|----------|---------------------|--------|
| hint-button | Custom styled button | Button (DS) | Consistent styling, accessible |
| hint-text | Custom div | Text (DS) | Typography controlled |
| feedback-toast | Missing | Toast (DS) | Required per Site Behavior |

## Components Used

| Component | Design System | Notes |
|-----------|---------------|-------|
| Button | @/ui/ds/Button | variant: primary, size: md |
| Text | @/ui/ds/Text | variant: body |
| Toast | @/ui/ds/Toast | type: success/error |

## Fixture Data

## Site Behaviors

## Implementation Plan

_Architect fills_
```

---

## Architect's Translation Job

```
┌─────────────────────────────────────────────────────────────────┐
│                     ARCHITECT DECISION                          │
│                                                                  │
│  Prototype Element          →  Design System Component          │
│  ─────────────────────────────────────────────────────────────  │
│  <button class="blue">   →  Button (variant: primary)        │
│  <div class="card">      →  Card                             │
│  <input type="text">     →  Input                            │
│  <nav class="sidebar">   →  Sidebar (pattern)                │
│  <div class="modal">     →  Modal                            │
│  Custom anything          →  Closest DS equivalent             │
│                                                                  │
│  If no DS equivalent exists:                                    │
│    → Propose new DS component                                  │
│    → Architect decides if needed                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SCENARIO EDITOR                           │
│                                                                  │
│  Design System ──────────────────────────────────────────────┐  │
│  Prototypes ───────────────────────────────────────────────┐ │  │
│  Site Behaviors ──────────────────────────────────────────┐ │ │  │
│  Scenarios ──────────────────────────────────────────────┐ │ │ │  │
│  Fixtures ──────────────────────────────────────────────┐ │ │ │ │  │
│  PRD Generator ──────────────────────────────────────┐ │ │ │ │ │  │
└────────────────────────────────────────────────────────┼─┼─┼─┼─┼─┘
                                                           │ │ │ │ │
                                                           ▼ ▼ ▼ ▼ ▼
┌─────────────────────────────────────────────────────────────────┐
│                         GITHUB ISSUE                             │
│                                                                  │
│  PRD includes:                                                  │
│  - Scenario                                                    │
│  - Prototype → DS translation table                            │
│  - Design System components to use                              │
│  - Site behaviors                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ARCHITECT AGENT                             │
│                                                                  │
│  Reviews prototype                                             │
│  Translates to Design System components                          │
│  Fills in component field in scenario                           │
│  Documents decisions in PRD                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CODY WORKFLOW                              │
│                                                                  │
│  Reads: PRD + Scenario (with DS components)                    │
│  Implements: Using Design System components                       │
│  NOT: Custom HTML/CSS from prototype                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         CI / PR                                  │
│                                                                  │
│  Pass → PR approved ✓                                           │
│  Fail → @cody fix ci fails                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Complete File Structure

```
scripts/qa/
├── index.ts
├── schema.ts                     # Scenarios, Steps, Fixtures
│
├── design-system/
│   ├── loader.ts               # Load DS components list
│   └── component-map.ts        # DS component registry
│
├── prototype/
│   ├── loader.ts               # Load HTML
│   ├── selector-extractor.ts   # Extract selectors
│   ├── interaction-parser.ts    # Parse onclick handlers
│   └── state-detector.ts      # Detect initial states
│
├── site-behavior/
│   ├── schema.ts
│   ├── loader.ts
│   └── behaviors/
│       ├── loading.json
│       ├── errors.json
│       ├── auth.json
│       └── ...
│
├── fixtures/
│   ├── schema.ts
│   ├── loader.ts
│   └── examples/
│
├── prd-generator.ts            # Generate PRD with DS decisions
├── scenario-loader.ts
└── validate-scenario.ts

site-docs/
├── behaviors/
│   ├── loading.json
│   ├── errors.json
│   └── ...
└── prototypes/
    └── exercise-page.html      # Reference only

src/ui/                          # DESIGN SYSTEM (Source of Truth)
├── components/
│   ├── Button/
│   ├── Input/
│   ├── Card/
│   ├── Modal/
│   ├── Toast/
│   └── ...
├── tokens/
└── patterns/

src/app/(frontend)/scenario-editor/
├── page.tsx
└── components/
    ├── design-system-browser.tsx  # Browse DS components
    ├── prototype-loader.tsx      # Load HTML
    ├── element-palette.tsx       # Show prototype elements
    ├── scenario-builder.tsx       # Build steps
    ├── ds-translator.tsx         # Map prototype → DS
    ├── site-behavior-editor.tsx
    ├── fixture-selector.tsx
    ├── prd-preview.tsx
    └── issue-creator.tsx
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (3-4 days)

| File | Purpose |
|------|---------|
| `scripts/qa/schema.ts` | All Zod schemas |
| `scripts/qa/design-system/loader.ts` | Load DS components |
| `scripts/qa/prototype/loader.ts` | Load HTML |
| `scripts/qa/prototype/selector-extractor.ts` | Extract selectors |
| `scripts/qa/site-behavior/schema.ts` | Site behavior schemas |
| `scripts/qa/site-behavior/loader.ts` | Load behaviors |
| `scripts/qa/fixtures/schema.ts` | Fixture schema |
| `scripts/qa/fixtures/loader.ts` | Load fixtures |
| `scripts/qa/prd-generator.ts` | Generate PRD with DS decisions |

### Phase 2: Scenario Editor UI (5-6 days)

| File | Purpose |
|------|---------|
| `page.tsx` | Main layout |
| `design-system-browser.tsx` | Browse DS components |
| `prototype-loader.tsx` | Load HTML |
| `element-palette.tsx` | Show elements + DS mapping |
| `ds-translator.tsx` | UI for mapping prototype → DS |
| `scenario-builder.tsx` | Build steps |
| `site-behavior-editor.tsx` | Edit behaviors |
| `fixture-selector.tsx` | Manage fixtures |
| `prd-preview.tsx` | Preview PRD |
| `issue-creator.tsx` | Create GH issue |

### Phase 3: GitHub Integration (1-2 days)

| File | Purpose |
|------|---------|
| `.github/ISSUE_TEMPLATE/scenario.md` | Issue template |
| `src/app/.../lib/gh-api.ts` | GitHub API |
| `.github/workflows/cody-scenario.yml` | Cody workflow |

### Phase 4: Testing & Polish (2-3 days)

| Task | Purpose |
|------|---------|
| Test with real HTML + DS | Validate mapping flow |
| Test site behavior editing | Validate CRUD |
| Test PRD generation | Validate output |
| E2E test generator | Generate Playwright tests |

---

## Estimation

| Phase | Days |
|-------|------|
| Phase 1: Core | 3-4 |
| Phase 2: UI | 5-6 |
| Phase 3: GitHub | 1-2 |
| Phase 4: Polish | 2-3 |
| **Total** | **11-15** |

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| **Design System Authority** | DS is source of truth | Consistent UI, maintainable |
| **Prototype is Suggestion** | Reference, not authority | Designer intent preserved |
| **Architect Translates** | Human maps prototype → DS | Domain knowledge, judgment |
| **Storage** | JSON | Zod validation |
| **Versioning** | Git | Same repo, commits = history |
| **Schema** | Zod | Type-safe |

---

## How Components Link

```
Scenario
  ├── prototype → provides element references
  ├── fixture → provides test data
  ├── siteBehaviors → references site behavior specs
  │
  └── steps
      ├── target → from prototype (reference)
      └── component → from Design System (filled by architect)

Prototype Elements
  └── Mapped to → Design System Components (by architect)

Design System Components
  └── ARE the implementation (used directly)

Site Behavior
  └── Applied by → Implementation
```

---

## The Translation Table (in PRD)

```markdown
## Prototype → Design System Translation

| Prototype Says | Design System Says | Reason |
|----------------|-------------------|--------|
| `<button class="blue-btn">` | `Button` | DS has verified variants |
| `<div class="card">` | `Card` | Consistent shadows, hover |
| `<input class="styled-input">` | `Input` | Built-in validation |
| No toast | `Toast` | Site Behavior requires feedback |
| Custom modal | `Modal` | Accessible, tested |
```

---

## Feedback Loop

```
Cody creates PR
        ↓
CI runs (lint, typecheck, e2e)
        ↓
Pass → PR approved ✓
Fail → @cody fix ci fails
        ↓
Cody catches comment, fixes, pushes
        ↓
CI reruns → Pass → PR approved
```

---

## Open Questions

1. ~~Storage format~~ → JSON
2. ~~Versioning~~ → Git-based
3. **Design System completeness?** → If DS lacks component, architect proposes addition
4. **Prototype as reference only?** → Yes, DS always wins
5. **Cody reads DS?** → Yes, DS components listed in PRD
