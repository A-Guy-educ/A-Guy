# Homepage Redesign: Feature Specification

**Feature:** Hebrew AI-Tutor Homepage
**Status:** Planning
**Owner:** Development Team
**Last Updated:** 2026-01-08

---

## Executive Summary

Replace the current CMS-driven homepage with a personalized, AI-tutor themed interface that guides students through their learning journey. The new design features a conversational onboarding flow, grade-level content filtering, and visual progress tracking to increase student engagement and course completion rates.

**Key Goals:**
- Improve first-time user onboarding experience
- Provide personalized content based on grade level
- Track and visualize student progress
- Support both anonymous and authenticated users

---

## Problem Statement

**Current State:**
- Generic CMS-driven homepage doesn't personalize to student needs
- No visible progress tracking to motivate students
- Unclear navigation for different learning modes (study, practice, test)
- First-time users lack guided onboarding

**User Pain Points:**
1. Students don't know where to start
2. No sense of achievement or progress visibility
3. Content isn't filtered by grade level
4. Anonymous users can't track progress across sessions

**Business Impact:**
- Lower course completion rates
- Higher bounce rates for new users
- Reduced engagement with practice/test features

---

## Solution Overview

Create a modern, Hebrew RTL homepage with:

### 1. **Personalized Onboarding Flow**
- Conversational greeting with typing animation
- Mood check for adaptive content (future use)
- Grade selection (7-12) for content filtering
- Saves preferences to localStorage

### 2. **Multi-Mode Navigation**
- **Study Mode**: Browse chapters/topics for learning
- **Practice Mode**: Access exercises and practice materials
- **Ask Mode**: View question history and conversations
- **Test Mode**: Access exams with performance stats

### 3. **Progress Tracking**
- Visual progress circles (0-100%) per topic
- Hybrid storage: localStorage (anonymous) + database (authenticated)
- Sync progress on login
- Stats dashboard in Test mode

### 4. **Responsive RTL Design**
- Mobile-first (480px base)
- Desktop expansion (900px+)
- Hebrew text with proper RTL layout
- Smooth animations and transitions

---

## User Stories

### Epic 1: First-Time User Onboarding

**US-1.1:** As a first-time visitor, I want to see a friendly greeting so I feel welcomed.
- **Acceptance Criteria:**
  - Typing animation displays "שלום! אני המורה הדיגיטלי שלך 🤖"
  - Animation completes before next step
  - Works on mobile and desktop

**US-1.2:** As a student, I want to select my grade level so I see relevant content.
- **Acceptance Criteria:**
  - Grade picker shows grades 7-12
  - Selection saves to localStorage
  - Redirects to Study page after selection
  - Future visits skip onboarding

**US-1.3:** As a student, I want to express my mood so the system can adapt (future).
- **Acceptance Criteria:**
  - 4 mood options displayed with emojis
  - Selection saved to profile
  - Currently stored but not used (placeholder for future)

### Epic 2: Content Navigation

**US-2.1:** As a student, I want to see topics for my grade level so I can start learning.
- **Acceptance Criteria:**
  - Chapters filtered by selected grade (courseLabel)
  - Progress circle shows completion % per chapter
  - Click chapter navigates to existing chapter page
  - Empty state shown if no content available

**US-2.2:** As a student, I want to switch between study/practice/ask/test modes so I can access different features.
- **Acceptance Criteria:**
  - Sticky navigation bar with 4 mode buttons
  - Active mode highlighted visually
  - Each mode shows relevant content
  - Routes: `/study`, `/practice`, `/ask`, `/test`

**US-2.3:** As a returning user, I want to skip onboarding and go directly to content.
- **Acceptance Criteria:**
  - Homepage checks localStorage for profile
  - Automatic redirect to `/study` if profile exists
  - No typing animation for returning users

### Epic 3: Progress Tracking

**US-3.1:** As an anonymous user, I want my progress saved locally so I don't lose it.
- **Acceptance Criteria:**
  - Progress stored in localStorage (prefixed `a-guy:progress`)
  - Persists across sessions
  - Clears if localStorage is deleted
  - Max 5MB storage (browser limit)

**US-3.2:** As a logged-in user, I want my progress saved to my account so I can access it anywhere.
- **Acceptance Criteria:**
  - Progress stored in UserProgress collection
  - Synced from localStorage on login
  - Merge strategy keeps highest completion %
  - Database becomes source of truth after login

**US-3.3:** As a student, I want to see my progress visually so I feel motivated.
- **Acceptance Criteria:**
  - Circular progress indicator (0-100%)
  - Smooth animation on value change
  - Shows percentage text in center
  - Uses theme colors (primary for progress, border for background)

### Epic 4: Test Mode & Stats

**US-4.1:** As a student, I want to see my exam statistics so I can track performance.
- **Acceptance Criteria:**
  - Stats header shows: Total exams, Completed, Avg score
  - Numbers update based on UserProgress data
  - Responsive grid (3 cards on desktop, stacked on mobile)
  - Shows 0 if no data available

**US-4.2:** As a student, I want to see available exams so I can prepare for tests.
- **Acceptance Criteria:**
  - Lists lessons filtered by grade level
  - Shows completion status per exam
  - Click navigates to lesson/exam page
  - Empty state if no exams available

---

## Technical Architecture

### Data Model

```
┌─────────────────┐
│  UserProgress   │ (NEW COLLECTION)
├─────────────────┤
│ user: ref       │ → Users collection
│ gradeLevel: str │ → "8", "ח", etc.
│ progressRecords │ → Array of:
│   - recordType  │    "chapter"|"lesson"|"exercise"
│   - recordId    │    String (ID of entity)
│   - completion% │    0-100
│   - status      │    "not_started"|"in_progress"|"completed"
│   - score       │    0-100 (for exercises)
│   - lastAccess  │    Date
└─────────────────┘
```

**Existing Collections Used:**
- `Courses` - Filtered by `courseLabel` (grade level)
- `Chapters` - Displayed as "Topics" in Study/Practice modes
- `Lessons` - Displayed as "Exams" in Test mode
- `Exercises` - User's questions/exercises in Ask mode
- `Conversations` - Chat history per exercise

### Component Hierarchy

```
HomePage (/)
└── GreetingFlow
    ├── TypingAnimation
    ├── Mood Selection (Buttons)
    └── Grade Selection (Select)

StudyPage (/study)
├── NavigationBar
└── StudyContent
    └── TopicCard[] (Chapter grid)
        ├── ProgressCircle
        └── Chapter info

PracticePage (/practice)
├── NavigationBar
└── PracticeContent (similar to StudyContent)

AskPage (/ask)
├── NavigationBar
└── AskContent
    └── QuestionCard[] (Exercise/Conversation list)

TestPage (/test)
├── NavigationBar
└── TestContent
    ├── StatsHeader (3 stat cards)
    └── ExamCard[] (Lesson list)
```

### Data Flow

**Anonymous User:**
```
1. Homepage → Check localStorage
2. No profile? → GreetingFlow → Save to localStorage
3. Has profile? → Redirect to /study
4. Study page → Fetch chapters by grade (API)
5. Display with progress from localStorage
6. Progress updates → Update localStorage
```

**Authenticated User:**
```
1. Login → Sync localStorage to database
2. Clear localStorage (database is source of truth)
3. All progress reads → Query UserProgress collection
4. All progress writes → API → Update database
5. Cross-device sync automatically works
```

### API Endpoints

**GET /api/chapters/by-grade?grade={gradeLevel}**
- Returns: `{ chapters: Chapter[], courseSlug: string }`
- Filters by courseLabel
- Only published & active courses

**POST /api/progress/update**
- Body: `{ recordId, recordType, completionPercentage, status }`
- Auth: Required (from session)
- Updates UserProgress collection
- Returns: `{ success: boolean }`

**Future: GET /api/progress/user**
- Returns: UserProgress for authenticated user
- Used to hydrate UI on page load

---

## Design Specifications

### Visual Design

**Color Integration:**

The design uses **existing theme variables** from `globals.css` rather than introducing new colors:

```css
/* LIGHT THEME - Use existing variables */
--primary: 217 91% 60%        /* Maps to #2d5af7 (primary actions) */
--success: 142 71% 45%        /* Maps to #27ae60 (completed items) */
--warning: 38 92% 50%         /* Maps to #f39c12 (warnings) */
--destructive: 0 84.2% 60.2%  /* Maps to #e74c3c (exams/errors) */
--accent: 271 91% 65%         /* Maps to #9b59b6 (questions/ask mode) */
--background: 0 0% 100%       /* Maps to #fcfdfe (light background) */
--foreground: 222.2 84% 4.9%  /* Maps to #1a1a1a (dark text) */
```

**Dark Theme Support:**
- All components use CSS variables (`hsl(var(--primary))`)
- Dark theme automatically applies when `[data-theme='dark']` is active
- No hardcoded hex colors in component code

**Usage in Components:**
```tsx
// ✅ Correct - uses theme variables
<circle stroke="hsl(var(--primary))" />
<div className="text-success">Completed</div>

// ❌ Wrong - hardcoded colors
<circle stroke="#2d5af7" />
<div style={{ color: '#27ae60' }}>Completed</div>
```

**Typography:**
- System font: Uses existing Geist font family (system-ui fallback)
- AI/Typing: `'Courier New', Courier, monospace` via `font-mono` class
- Hebrew support: Already configured in project

**Spacing:**
- Uses Tailwind spacing scale: `p-4`, `gap-4`, `mb-8`, etc.
- Container: `container mx-auto` (responsive by default)
- Grid gaps: `gap-4` (1rem / 16px)
- Card padding: Uses shadcn/ui Card defaults
- Border radius: Uses `--radius` variable (0.75rem)

**Design System Constraints:**
- ✅ **Use only:** Tailwind classes, shadcn/ui components, CSS variables
- ❌ **Never create:** New CSS/SCSS files, inline hardcoded styles, custom CSS classes
- ✅ **Styling approach:** Utility-first with Tailwind, compose with shadcn/ui
- ❌ **Forbidden:** `HomePage.module.css`, `styles.scss`, styled-components

### Responsive Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| Mobile | < 640px | 1 column grid |
| Tablet | 640px - 1024px | 2 column grid |
| Desktop | > 1024px | 3 column grid |

### Animations

1. **Typing Animation**: 50ms per character, blinking cursor
2. **Progress Circle**: 500ms transition on value change
3. **Card Hover**: translateY(-4px) on hover, 300ms ease
4. **Fade In**: Page transitions fade + slide up, 500ms ease-out

---

## Implementation Phases

### Phase 1: Foundation (Data Layer)
**Duration:** 1-2 days
**Deliverables:**
- UserProgress collection created
- Query functions implemented
- localStorage utilities created
- Type generation complete

**Success Criteria:**
- `pnpm typecheck` passes
- UserProgress collection accessible in admin panel
- Can manually query progress data

### Phase 2: Components (UI Library)
**Duration:** 2-3 days
**Deliverables:**
- ProgressCircle component
- TypingAnimation component
- NavigationBar component
- TopicCard component
- GreetingFlow component

**Success Criteria:**
- All components render in isolation
- TypeScript errors resolved
- Translations added (Hebrew + English)
- Storybook/test pages verify functionality (optional)

### Phase 3: Routes (Pages)
**Duration:** 2-3 days
**Deliverables:**
- Homepage replacement
- Study page + API route
- Practice, Ask, Test pages
- Navigation between modes

**Success Criteria:**
- All routes accessible via browser
- Navigation bar highlights active route
- Content loads from API
- Empty states display correctly

### Phase 4: Integration (Data Sync)
**Duration:** 1-2 days
**Deliverables:**
- Progress sync function
- Login integration
- Progress update hook
- API routes for progress

**Success Criteria:**
- Anonymous progress saves to localStorage
- Login syncs localStorage → database
- Authenticated progress saves to database
- No data loss during sync

### Phase 5: Polish (Styling & Testing)
**Duration:** 1-2 days
**Deliverables:**
- RTL styling finalized
- Responsive design verified
- Animations smooth
- Loading/error states polished

**Success Criteria:**
- Works on mobile (480px)
- Works on desktop (900px+)
- Hebrew text displays correctly
- No console errors

---

## Success Metrics

### Technical Metrics
- [ ] TypeScript compilation: 0 errors
- [ ] Lighthouse score: 90+ (Performance, Accessibility)
- [ ] Page load time: < 2s (p95)
- [ ] localStorage size: < 1MB for typical user

### User Experience Metrics
- [ ] Onboarding completion rate: 80%+ (reach /study page)
- [ ] Return user redirect: < 500ms (cache hit)
- [ ] Progress sync success rate: 99%+ (on login)
- [ ] Mobile usability: No horizontal scroll, all buttons tappable

### Business Metrics (Post-Launch)
- [ ] Course completion rate: +15% (3 months)
- [ ] Daily active users: +20% (1 month)
- [ ] Bounce rate: -25% (new users)
- [ ] Time on site: +30% (1 month)

---

## Risks & Mitigations

### Risk 1: localStorage Size Limits
**Impact:** High | **Probability:** Medium
**Description:** Users with extensive progress may exceed 5MB localStorage limit

**Mitigation:**
- Implement data pruning (keep last 100 records)
- Warn users to log in for unlimited storage
- Monitor localStorage usage in production
- Fallback to session-only storage if quota exceeded

### Risk 2: courseLabel Format Mismatch
**Impact:** High | **Probability:** Low
**Description:** Courses may use Hebrew ("ח") vs numeric ("8") labels inconsistently

**Mitigation:**
- Query database to verify actual values before launch
- Support both formats in filter logic
- Add admin documentation for courseLabel standards

### Risk 3: Progress Sync Conflicts
**Impact:** Medium | **Probability:** Low
**Description:** User progresses on two devices while anonymous, then logs in

**Mitigation:**
- Merge strategy keeps highest completion %
- Document sync behavior in user guide
- Add timestamp-based conflict resolution (future)

### Risk 4: Breaking Existing Homepage
**Impact:** High | **Probability:** Low
**Description:** Replacing homepage may break existing user flows or integrations

**Mitigation:**
- Create backup of existing page.tsx
- Feature flag for gradual rollout (optional)
- Monitor error rates post-deployment
- Rollback plan: restore backup file

---

## Dependencies

### External Dependencies
- Payload CMS 3.x
- Next.js 14+ (App Router)
- React 18+
- Tailwind CSS + shadcn/ui

### Internal Dependencies
- Existing collections: Courses, Chapters, Lessons, Exercises
- Existing auth system (Payload users)
- Existing i18n setup (useTranslations hook)
- Existing theme system (CSS variables)

### Blocking Dependencies
None - all required systems exist in current codebase

---

## Testing Strategy

### Unit Tests
- localStorage utilities (SSR safety)
- Progress merge logic (conflict resolution)
- Component prop validation

### Integration Tests
- API routes (chapters by grade, progress update)
- Query functions (data fetching)
- Sync workflow (localStorage → database)

### E2E Tests (Critical Paths)
1. **First-time user flow:**
   - Visit / → See greeting → Select mood → Select grade → Redirect to /study
2. **Returning user flow:**
   - Visit / → Auto-redirect to /study
3. **Progress tracking:**
   - Complete exercise → Progress updates → Visible in UI
4. **Login sync:**
   - Progress as anonymous → Login → Progress persists → Accessible on new device

### Manual Testing
- Mobile devices (iOS Safari, Android Chrome)
- Desktop browsers (Chrome, Firefox, Safari)
- RTL layout verification
- Animation smoothness
- Accessibility (keyboard navigation, screen readers)

---

## Rollout Plan

### Pre-Launch
1. Code review with senior developer
2. QA testing on staging environment
3. Performance profiling (Lighthouse)
4. Security review (access control, data privacy)

### Launch Strategy

**Option A: Hard Cutover (Recommended)**
- Deploy all changes at once
- Monitor error rates for 24h
- Rollback plan ready

**Option B: Gradual Rollout**
- Feature flag: `ENABLE_NEW_HOMEPAGE=true`
- Roll out to 10% users → 50% → 100%
- A/B test metrics vs old homepage

### Post-Launch
1. Monitor analytics for 1 week
2. Collect user feedback
3. Fix critical bugs within 48h
4. Iterate on non-critical improvements

---

## Open Questions

1. **Mood Selection Usage:** How should mood affect content? (Future feature)
2. **Progress Weighting:** Should chapter progress auto-calculate from lesson progress?
3. **Test Mode Filtering:** Do we need a separate "exam" type for lessons?
4. **Anonymous Progress Limit:** Should we cap localStorage records? How many?
5. **Login Integration:** Where is the login success handler? (Need to add sync call)

---

## References

- [Implementation Plan](./implementation-plan.md)
- [Project Documentation](../../AGENTS.md)
- [Payload CMS Collections](../../src/server/payload/collections/)

---

## Changelog

| Date | Author | Changes |
|---|---|---|
| 2026-01-08 | Claude | Initial specification created |

---

**Next Steps:**
1. Review spec with stakeholders
2. Confirm design decisions (mood usage, test filtering)
3. Clarify open questions (login integration point)
4. Begin Phase 1 implementation
