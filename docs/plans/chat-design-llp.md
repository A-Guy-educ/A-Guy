# Low-Level Plan: Math Learning Chat UI Redesign (Revised)

## Locked Contracts

These behaviors are **contractual and must remain exactly as-is**:

- **Auto-scroll**: Unconditional scroll-to-bottom on new messages
- **KaTeX pipeline**: Uses `remark-math` + `rehype-katex` + existing RTL/LTR wrappers
- **Math direction**: Forced LTR via `rehypeMathWrapper` adding `dir="ltr"` wrappers for inline and block KaTeX output (with isolate)
- **Bubble max-width**: `max-w-[85%]`
- **Math failure behavior**: KaTeX default (visible parse errors, no error boundary)
- **User alignment**: Right-aligned via `ml-auto`
- **Bot alignment**: Left-aligned via `mr-auto`
- **No new CSS classes**: Styling via Tailwind utilities only
- **No tests in this iteration**

---

## Implementation Path

Restyle and adjust the existing chat implementation (`ChatInterface` as the baseline, `NotebookChat` as the non-baseline variant) to match Figma demo. The `ChatInterface` component at `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/ChatInterface/index.tsx` is the primary implementation surface. Quick action buttons in `NotebookChat` are treated as a known divergence.

---

## Stage Plan

### Stage 1: UI Parity

Restyle existing ChatInterface component (baseline) to match Figma design. Do not refactor NotebookChat in this iteration.
- Update header styling
- Adjust bubble padding, border-radius, shadows
- Match spacing and vertical rhythm between messages
- Restyle input composer to match demo

### Stage 2: Math Parity Verification

Verify KaTeX rendering matches Figma visual style:
- Confirm block math is visually separated and centered
- Confirm inline math isolation works correctly
- No changes to existing math pipeline

### Stage 3: Tables (Optional)

Add table support only if markdown table output is observed in demo or production content.

---

## Concrete Task List

### File: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/NotebookChat/index.tsx`

**Header Restyling:**
- [ ] Update header container padding: `p-3` (existing)
- [ ] Update header text styling: `font-medium text-sm` (existing)
- [ ] LLP change required: Add `text-xs text-muted-foreground` for lesson name if in Figma

**Message List Container:**
- [ ] Adjust container padding: `p-4` (existing)
- [ ] Adjust message spacing: `space-y-3` (existing)
- [ ] Preserve auto-scroll behavior (unconditional)

**Message Bubble Styling:**
- [ ] Update user bubble: `max-w-[85%] px-[18px] py-3.5 text-base leading-relaxed shadow-sm`
- [ ] User bubble border-radius: `rounded-[20px] rounded-bl-[4px]`
- [ ] Update bot bubble: `max-w-[85%] px-[18px] py-3.5 text-base leading-relaxed shadow-sm`
- [ ] Bot bubble border-radius: `rounded-[20px] rounded-br-[4px]`

**Input Composer Restyling:**
- [ ] LLP change required: Apply `max-w-[850px] mx-auto bg-muted rounded-[30px] flex items-center px-4 py-1.5 border border-input gap-3` to input wrapper div
- [ ] LLP change required: Apply `flex-1 bg-transparent border-none outline-none py-2.5 text-[17px]` to input field
- [ ] LLP change required: Apply `w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-input hover:bg-primary/90 transition-all hover:scale-105` to send button

### File: `src/components/chat/ChatMessageContent/index.tsx`

**Math Rendering Verification:**
- [ ] Verify KaTeX CSS overrides in `.chat-message-content .katex` match Figma
- [ ] Ensure block math (`.katex-display`) is visually separated
- [ ] Verify inline math isolation works in RTL context
- [ ] No changes to existing `rehypeMathWrapper` plugin

**Table Support (Optional):**
- [ ] Add table components to `markdownComponents` only if tables are observed in content
- [ ] Use Tailwind utilities: `overflow-x-auto my-4`, `w-full border-collapse`
- [ ] Mobile overflow handling for tables

### File: `src/app/(frontend)/globals.css`

**KaTeX Styling:**
- [ ] Review `.chat-message-content .katex` overrides
- [ ] Ensure dark mode compatibility
- [ ] Verify math sizing matches Figma

---

## Figma-to-Tailwind Mapping

The following mappings are grounded in existing codebase utilities. Items marked "LLP change required" need implementation.

| UI Element | Tailwind Utilities (Existing) | Notes |
|------------|------------------------------|-------|
| Chat container/card | `flex flex-col h-full min-h-0` | ChatInterface baseline |
| Header container | `p-5 pb-8 relative bg-card border-t border-border` | ChatInterface - input area header |
| Message list container | `flex-grow overflow-y-auto p-5 space-y-4 min-h-0` | ChatInterface baseline |
| Message row gap | `space-y-4` | ChatInterface baseline |
| User bubble | `ml-auto bg-primary text-primary-foreground rounded-[20px] rounded-bl-[4px] px-[18px] py-3.5 text-base leading-relaxed shadow-sm max-w-[85%]` | ChatInterface baseline |
| Bot bubble | `mr-auto bg-card text-foreground border border-border rounded-[20px] rounded-br-[4px] px-[18px] py-3.5 text-base leading-relaxed shadow-sm max-w-[85%]` | ChatInterface baseline |
| Thinking indicator | `mr-auto bg-card text-foreground border border-border px-[18px] py-3.5 rounded-[20px] rounded-br-[4px] max-w-[85%] flex items-center gap-2 shadow-sm` | ChatInterface baseline |
| Input wrapper | `max-w-[850px] mx-auto bg-muted rounded-[30px] flex items-center px-4 py-1.5 border border-input gap-3` | ChatInterface baseline |
| Input field | `flex-1 bg-transparent border-none outline-none py-2.5 text-[17px] text-foreground placeholder:text-muted-foreground` | ChatInterface baseline |
| Send button | `w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-input hover:bg-primary/90 transition-all hover:scale-105` | ChatInterface baseline |
| Math keyboard toggle | `p-1.5 text-muted-foreground hover:text-primary transition-colors` | ChatInterface baseline |
| Plus/upload button | `p-1.5 text-muted-foreground hover:text-primary transition-colors` | ChatInterface baseline |
| Formula panel toggle | `p-1 text-muted-foreground hover:text-primary transition-colors` | ChatInterface baseline |

---

## Known Divergences (Non-baseline)

- **NotebookChat message spacing**: Uses `space-y-3` instead of `space-y-4`
- **NotebookChat message bubble**: Uses `p-3 rounded-lg` instead of `px-[18px] py-3.5 rounded-[20px]`
- **NotebookChat bubble background**: Uses `bg-muted` for bot instead of `bg-card border border-border`
- **NotebookChat input**: Uses `flex-1 px-4 py-2 bg-muted border border-border rounded-lg` instead of `flex-1 bg-transparent border-none outline-none py-2.5 text-[17px]`
- **NotebookChat input wrapper**: Uses simple `flex gap-2 p-3 border-t border-border` instead of `max-w-[850px] mx-auto bg-muted rounded-[30px] flex items-center px-4 py-1.5 border border-input gap-3`
- **NotebookChat send button**: Uses `p-2 rounded-lg` instead of `w-10 h-10 rounded-full`
- **NotebookChat quick actions**: Has three quick action buttons (Hint, Solution, Full Solution) above input that ChatInterface does not have
- **NotebookChat message container**: Uses `h-full flex flex-col bg-card` and `flex-1 overflow-y-auto p-4` instead of `flex flex-col h-full min-h-0` and `flex-grow overflow-y-auto p-5 space-y-4 min-h-0`

---

## Input Composer (Locked Behavior)

The input composer behavior is **locked** and must not change. This section describes the `ChatInterface` baseline implementation only.

**Element Type:**
- Input element is `<input type="text">` at [`ChatInterface/index.tsx`](src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/ChatInterface/index.tsx:157)
- Fixed-height behavior (no autosize)
- This implementation is contract and must be preserved

**Submit Behavior:**
- Enter key submits message (line 167: `if (e.key === 'Enter' && !e.shiftKey)`)
- Shift+Enter allows newlines (default behavior preserved)
- Form submission via `handleFormSubmit` handler (line 77)
- Behavior is locked and must not change

**Buttons (ChatInterface baseline):**
- Math keyboard toggle button with ƒ character (line 176-189)
- Plus/upload button (line 191-195)
- Send button (circular, `w-10 h-10 rounded-full`) (line 197-205)
- Formula panel toggle button (line 137-151)

**Buttons (NotebookChat variant, known divergence):**
- Three quick action buttons: Hint, Solution, Full Solution (above input area)
- No math keyboard, formula panel, or upload button
- Send button is rectangular (`p-2 rounded-lg`)

**Restyling Notes:**
- Any restyling must use existing Tailwind utilities
- No new CSS classes
- Maintain existing button functionality
- Preserve existing accessibility attributes (aria-labels)

---

## Out of Scope

**Tests:**
- No unit tests, UI tests, or snapshot tests
- No test gates or assertions
- No test plans or test sections

**Behaviors:**
- No error boundaries for math rendering
- No graceful fallback UI for invalid LaTeX
- No changes to auto-scroll behavior
- No changes to KaTeX pipeline
- No changes to math direction handling
- No changes to input element type (must remain `<input type="text">`)
- No changes to fixed-height behavior

**Features:**
- Quick action buttons (Hint/Solution/Full) unless explicitly in Figma demo
- New keyboard or submission behaviors
- New feedback mechanisms
- New loading indicators not in demo
- New composer buttons unless in Figma demo

**Components:**
- New reusable component library
- New component files unless replacing existing structure
- New CSS classes


