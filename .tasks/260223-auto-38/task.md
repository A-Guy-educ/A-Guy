# Task

VideoMedia component added `suspend` event listeners without cleanup, accumulating on each navigation mount.

## Changes

**Component** (`src/ui/web/media/VideoMedia/index.tsx`)
- Extract anonymous handler to named function `handleSuspend`
- Add cleanup return to remove listener on unmount

**Tests** (`tests/unit/ui/web/media/VideoMedia.test.tsx`)
- Add 8 tests covering listener lifecycle, navigation cycles, edge cases
- Explicit type annotations `(call: any[])` on spy.mock.calls filters to resolve TS7006 errors

## Example

```tsx
// Before
useEffect(() => {
  if (video) {
    video.addEventListener('suspend', () => { /* ... */ })
  }
}, [])

// After
useEffect(() => {
  if (!video) return
  const handleSuspend = () => { /* ... */ }
  video.addEventListener('suspend', handleSuspend)
  return () => video.removeEventListener('suspend', handleSuspend)
}, [])
```

<!-- START COPILOT ORIGINAL PROMPT -->



<details>

<summary>Original prompt</summary>

> 
> ----
> 
> *This section details on the original issue you should resolve*
> 
> <issue_title>[MEDIUM] Bug: VideoMedia event listener not cleaned up in useEffect</issue_title>
> <issue_description>## Description
> The `VideoMedia` component adds a `suspend` event listener to the `<video>` element in a `useEffect` but never removes it on cleanup. Navigating away and back accumulates duplicate listeners.
> 
> ## Files Affected
> - `src/ui/web/media/VideoMedia/index.tsx` — lines 16-24
> 
> ## Current Code
> ```tsx
> useEffect(() => {
>   const video = videoRef.current
>   if (video) {
>     video.addEventListener('suspend', () => {
>       // handler
>     })
>   }
>   // ❌ Missing cleanup: return () => video.removeEventListener(...)
> }, [])
> ```
> 
> ## Expected Fix
> ```tsx
> useEffect(() => {
>   const video = videoRef.current
>   if (!video) return
>   
>   const handler = () => { /* ... */ }
>   video.addEventListener('suspend', handler)
>   
>   return () => video.removeEventListener('suspend', handler)
> }, [])
> ```
> 
> ## Steps to Test
> 1. Navigate to a page with a video component
> 2. Navigate away, then back, several times
> 3. Check DevTools Performance tab for accumulated event listeners
> 4. After fix: only one listener at a time
> 
> ## Priority
> MEDIUM — Memory leak, accumulates on navigation</issue_description>
> 
> <agent_instructions>Task: Fix potential event listener memory leak in VideoMedia component.
> 
> Context:
> In src/ui/web/media/VideoMedia/index.tsx, the component attaches a 'suspend' event listener to a <video> element inside a useEffect, but does not reliably remove it on cleanup. Navigating away and back may accumulate duplicate listeners.
> 
> Requirements:
> 
> 1. Refactor the existing useEffect so that:
> 
>    * The handler function is defined inside the effect and stored in a stable reference within that scope.
>    * The listener is added only if videoRef.current exists.
>    * A proper cleanup function is returned that removes the exact same handler reference using removeEventListener.
>    * No duplicate listeners are added on re-mount.
> 
> 2. Ensure:
> 
>    * The effect dependency array is correct.
>    * There are no null-reference errors.
>    * The solution is idiomatic React and safe for re-renders.
> 
> 3. Do NOT change unrelated logic.
> 
> 4. Keep the fix minimal and focused.
> 
> Optional (if simple):
> Add a short inline comment explaining why cleanup is required to avoid listener accumulation.
> 
> Output:
> Return the full corrected useEffect block only.
> </agent_instructions>
> 
> ## Comments on the Issue (you are @copilot in this section)
> 
> <comments>
> </comments>
> 


</details>



<!-- START COPILOT CODING AGENT SUFFIX -->

- Fixes A-Guy-educ/A-Guy#509

<!-- START COPILOT CODING AGENT TIPS -->
---

✨ Let Copilot coding agent [set things up for you](https://github.com/A-Guy-educ/A-Guy/issues/new?title=✨+Set+up+Copilot+instructions&body=Configure%20instructions%20for%20this%20repository%20as%20documented%20in%20%5BBest%20practices%20for%20Copilot%20coding%20agent%20in%20your%20repository%5D%28https://gh.io/copilot-coding-agent-tips%29%2E%0A%0A%3COnboard%20this%20repo%3E&assignees=copilot) — coding agent works faster and does higher quality work when set up for your repo.
