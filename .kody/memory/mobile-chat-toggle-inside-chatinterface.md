---
name: mobile-chat-toggle-inside-chatinterface
title: Mobile Chat Toggle Inside Chatinterface
type: lesson
source: task:2140
recorded_at: 2026-05-28T12:06:29Z
---

MobileChatToggle must be rendered inside ChatInterface on mobile to access internal state (handleSubmit, inputValue, etc.). Rendering it in SplitPaneLayout requires passing too many disconnected callbacks.

**Why:** ChatInterface owns the input state and submit handler. MobileChatToggle needs to call handleSubmit(e) with the form event, which requires access to ChatInterface's internal handleFormSubmit function.

**How to apply:** When adding mobile FAB-style inputs to components, render them inside the component that owns the state, not in a parent wrapper.

**Why:** Initial attempt to place MobileChatToggle in SplitPaneLayout required passing fake/stub props for onSubmit, onInputChange, etc. The real architecture requires it inside ChatInterface.

**Source task:** `2140`
