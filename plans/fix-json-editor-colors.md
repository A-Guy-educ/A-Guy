# Fix JSON Editor Invisible Colors in Edit Mode

## Problem Summary

In the Payload Admin Exercise Editor, when editing JSON in the JSONInspector component, the text is invisible. The JSON should display with colorful syntax highlighting (similar to the read-only view mode).

## ✅ SOLUTION IMPLEMENTED

**Approach**: Quick fix - made textarea text visible (trade-off: no syntax highlighting while editing)

**Changes Made**:

1. Changed textarea `color` from `transparent` to `#d4d4d4`
2. Changed textarea `background` from `transparent` to `#1e1e1e`
3. Removed `-webkit-text-fill-color: transparent` property
4. Hidden the pre overlay with `display: none` (since textarea now has opaque background)

**Result**: JSON text is now fully visible in edit mode on a dark background. The text appears in light gray which provides good readability.

**Trade-off**: No syntax highlighting while actively editing (typing). Syntax highlighting still appears in read-only view mode.

---

## Original Root Cause Analysis

The JSON editor uses a **layered overlay approach**:

1. A `<pre>` element with syntax highlighting (via `prism-react-renderer`) positioned at z-index: 1
2. A `<textarea>` with transparent text positioned at z-index: 2 (so you can type)

The syntax-highlighted `<pre>` should show through the transparent textarea, but it's not working due to CSS issues.

### Issue 1: CSS Rule Forcing All Colors to Gray

In [`index.css:874-877`](../src/components/admin/ExerciseContentEditor/index.css:874):

```css
/* Override all Prism inline color styles with visible colors for dark background */
.json-inspector__pre--overlay span[style*='color'] {
  color: #d4d4d4 !important;
}
```

This rule matches **ALL** spans with inline `color` styles and forces them to a single gray color (`#d4d4d4`). Since `prism-react-renderer` applies colors via inline styles on every token span, this rule overrides ALL syntax highlighting colors to gray.

### Issue 2: Ineffective Token CSS Rules

The CSS rules at lines 880-898 target `.token.property`, `.token.string`, etc.:

```css
.json-inspector__pre--overlay .token.property {
  color: #9cdcfe !important;
}
```

These rules are **ineffective** because `prism-react-renderer` does NOT add `.token` classes - it only uses inline styles. These rules never match any elements.

### Issue 3: Scroll Synchronization

The current implementation only syncs scroll from textarea → pre, but not the reverse. This can cause visual misalignment.

## Solution

### Step 1: Remove the Problematic CSS Override

Delete or comment out lines 874-877 in [`index.css`](../src/components/admin/ExerciseContentEditor/index.css):

```css
/* REMOVE THIS BLOCK - it overrides all prism colors to gray */
.json-inspector__pre--overlay span[style*='color'] {
  color: #d4d4d4 !important;
}
```

The `prism-react-renderer` vsDark theme already provides good colors for dark backgrounds.

### Step 2: Remove Ineffective Token Rules

Delete lines 880-898 (the `.token.*` rules) since they don't apply:

```css
/* REMOVE THESE - prism-react-renderer doesn't use .token classes */
.json-inspector__pre--overlay .token.property { ... }
.json-inspector__pre--overlay .token.string { ... }
.json-inspector__pre--overlay .token.number { ... }
.json-inspector__pre--overlay .token.boolean, .token.null { ... }
.json-inspector__pre--overlay .token.punctuation { ... }
```

### Step 3: Verify Pre Overlay Positioning

Ensure the pre overlay has proper CSS for visibility:

```css
.json-inspector__pre--overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 1rem;
  border: 1px solid var(--theme-elevation-200);
  border-radius: 4px;
  pointer-events: none;
  z-index: 1;
  overflow: auto;
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8125rem;
  line-height: 1.6;
  white-space: pre;
  background: #1e1e1e !important;
}
```

### Step 4: Keep Child Background Transparent Rule

Keep this rule to ensure prism wrapper elements don't add backgrounds:

```css
.json-inspector__pre--overlay *,
.json-inspector__pre--overlay code,
.json-inspector__pre--overlay div {
  background: transparent !important;
}
```

## Files to Modify

1. **[`src/components/admin/ExerciseContentEditor/index.css`](../src/components/admin/ExerciseContentEditor/index.css)**
   - Remove lines 874-877 (span color override)
   - Remove lines 880-898 (ineffective .token.\* rules)

## Testing

1. Navigate to Payload Admin → Exercises
2. Edit an exercise with content blocks
3. Click the Edit button on the JSON Inspector
4. Verify JSON displays with colorful syntax highlighting:
   - Property names: blue (`#9cdcfe`)
   - Strings: orange/brown (`#ce9178`)
   - Numbers: green (`#b5cea8`)
   - Booleans/null: blue (`#569cd6`)
   - Punctuation: gray (`#d4d4d4`)

## Alternative Approach (If Issues Persist)

If the overlay approach continues to have issues, consider switching to a dedicated code editor component:

1. **Monaco Editor** - The same editor used in VS Code
2. **CodeMirror 6** - Lightweight and customizable
3. **@uiw/react-textarea-code-editor** - Simple syntax-highlighted textarea

These provide built-in syntax highlighting without the overlay complexity.
