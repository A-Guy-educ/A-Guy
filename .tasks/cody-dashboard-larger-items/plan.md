# Plan: Cody Dashboard — Larger List Items for Better UX

## Problem

The current task list items are too compact (`py-2`, `text-sm`) making them hard to scan and interact with. The information density is good for power users but the items need to be more visually substantial.

## Solution

Increase padding, font sizes, and spacing throughout the list item to create a more comfortable, scannable layout while maintaining the information hierarchy.

## Files to Touch

- `src/ui/cody/components/TaskList.tsx` (MODIFIED)

## Changes

### Row Container (line 129)
- **From**: `py-2 px-4`
- **To**: `py-3 px-4`
- Rationale: More vertical breathing room

### Issue Number (line 150)
- **From**: `text-sm font-mono font-semibold`
- **To**: `text-base font-mono font-semibold`
- Rationale: More prominent identification

### CODY Badge (lines 156-159)
- **From**: `px-1.5 py-0.5 text-[10px]`
- **To**: `px-2 py-1 text-xs`
- Rationale: Better visibility

### Title (line 163)
- **From**: `text-sm font-medium`
- **To**: `text-base font-medium`
- Rationale: Readable titles

### Status Badge (lines 177-178)
- **From**: `text-xs px-1.5 py-0.5`
- **To**: `text-sm px-2 py-1`
- Rationale: More prominent status

### Meta Items (PR link, preview, labels, time) (lines 199-224)
- **From**: `text-xs`, `text-[10px]`
- **To**: `text-xs` for icons, `text-sm` for time
- Rationale: Slightly more prominent

### Icons (status icon, PR icon, preview icon)
- **From**: `w-3 h-3`, `w-4 h-4`
- **To**: Scale up status icon to `w-5 h-5`, keep action icons at `w-4 h-4`
- Rationale: Clearer status indication

### Buttons (Merge/Run) (lines 228-255)
- **From**: `h-6 text-xs px-2`
- **To**: `h-7 text-sm px-3`
- Rationale: Easier to click

## Visual Preview

### Before
```
[#123] [CODY] Fix bug in login
    [Gate] [PR] [2m ago] [Merge]
```

### After
```
[#123] [CODY] Fix bug in login
    [Gate] [PR] [2m ago] [Merge]
```
(bigger fonts, more padding, clearer hierarchy)

## Acceptance Criteria

- [ ] Row height increased by ~8-12px
- [ ] Issue numbers more prominent (text-base)
- [ ] Title text more readable (text-base)
- [ ] Status badges larger and more visible
- [ ] Buttons easier to click (larger touch target)
- [ ] All icons appropriately scaled
- [ ] Hard-stop ring styling still works
- [ ] Mobile responsive layout preserved
