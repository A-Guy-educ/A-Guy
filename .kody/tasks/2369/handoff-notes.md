## Fix #2369: Login/Signup Page Horizontal Overflow on Mobile

### What
Added `relative overflow-hidden` to the outer wrapper div in `LoginPageContent.tsx` and `SignupPageContent.tsx`. This ensures:
1. The 500×500px decorative gradient circle positions against the wrapper (not `<body>`)
2. The `blur-3xl` halo is clipped to the viewport on mobile

### Files
- `src/app/(frontend)/login/LoginPageContent.tsx` — added `relative overflow-hidden` to wrapper
- `src/app/(frontend)/signup/SignupPageContent.tsx` — same fix applied

### Why
The absolute circle lacked a `relative` containing block, so it escaped to `<body>` for positioning. On mobile viewports (<500px), the circle + blur halo bled beyond the viewport edge causing horizontal scroll.
