# TASK-16: Chat Panel Component

## Summary
Create the CopilotKit chat panel component and integrate it into the dashboard layout.

## Task Type
implement_feature

## Dependencies
- TASK-15 (CopilotKit runtime)

## Requirements

### R1: CodyChatPanel component
- File: `src/ui/admin/CodyChat/CodyChatPanel.tsx`
- Client component
- Uses `<CopilotChat>` from `@copilotkit/react-ui` (the built-in component, not headless)
- Positioned as a collapsible right panel or floating button
- Custom styling to match dashboard theme (dark sidebar, clean messages)
- Import CopilotKit CSS: `import '@copilotkit/react-ui/styles.css'`
- Custom labels: placeholder text "Ask about tasks, pipelines, or take actions..."

### R2: Integration with dashboard
- Update `src/ui/admin/CodyDashboard/index.tsx`
- Add toggle button to show/hide chat panel
- Layout: board takes most width, chat panel slides in from right (or use CopilotPopup for less intrusion)
- Chat panel state persists while navigating between tasks

### R3: Responsive
- On wide screens: side panel
- On narrow screens: overlay/popup

## Files to Create/Modify
- `src/ui/admin/CodyChat/CodyChatPanel.tsx` (NEW)
- `src/ui/admin/CodyDashboard/index.tsx` (MODIFIED)

## Acceptance Criteria
- [ ] Chat panel appears when toggled
- [ ] Can send messages and receive responses
- [ ] Chat persists while clicking different task cards
- [ ] Responsive layout works
- [ ] `pnpm tsc --noEmit` passes
