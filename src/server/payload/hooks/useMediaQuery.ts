import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  // Initialize with null to indicate "not yet determined" during SSR/hydration
  // This prevents hydration mismatch since server always renders false
  const [matches, setMatches] = useState<boolean | null>(null)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)

    const listener = () => setMatches(media.matches)
    media.addEventListener('change', listener)

    return () => media.removeEventListener('change', listener)
  }, [query])

  // During SSR/hydration (matches === null), return false
  return matches ?? false
}
