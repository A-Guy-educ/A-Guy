# Task

## Description
Three components trigger `fetch()` inside `useEffect` without an `AbortController`. If the component unmounts mid-fetch, the `.then()` callback tries to set state on an unmounted component.

## Files Affected
| File | Line | Component |
|------|------|-----------|
| `src/ui/web/homepage/GreetingFlow/index.tsx` | 28-45 | GreetingFlow |
| `src/app/(frontend)/account/_components/SelectedCourseCard.tsx` | 29-38 | SelectedCourseCard |
| `src/ui/web/components/HealthBadge.tsx` | 24-44 | HealthBadge |

## Expected Fix
```tsx
useEffect(() => {
  const controller = new AbortController()
  
  fetch('/api/...', { signal: controller.signal })
    .then(res => res.json())
    .then(data => setData(data))
    .catch(err => {
      if (err.name !== 'AbortError') console.error(err)
    })

  return () => controller.abort()
}, [])
```

## Priority
LOW — Potential memory leak / React warning on fast navigation
