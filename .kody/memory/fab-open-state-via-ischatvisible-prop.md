---
name: fab-open-state-via-ischatvisible-prop
title: Fab Open State Via Ischatvisible Prop
type: decision
source: task:2140
recorded_at: 2026-05-28T12:06:29Z
---

MobileChatToggle uses `isInternalOpen = isOpen || isChatVisible` to combine its own open state with the parent-controlled visibility. This allows both user-triggered open/close AND parent-triggered visibility changes.

**Why:** SplitPaneLayout controls whether chat is visible via viewMode and chatExpandedInPdf state. When SplitPaneLayout shows chat (viewMode='CHAT' or expanded), the FAB should be hidden even if user hasn't explicitly closed it.

**How to apply:** For components that can be controlled by both internal state and external props, use OR pattern to combine them.

**Why:** SplitPaneLayout's mobile viewMode state determines if chat is visible, independent of FAB's own open/close state.

**Source task:** `2140`
