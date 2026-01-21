import Link from 'next/link'

import { Button } from '@/components/ui/button'

interface GoogleSignupButtonProps {
  label: string
  returnTo?: string
  className?: string
}

export function GoogleSignupButton({ label, returnTo, className }: GoogleSignupButtonProps) {
  const href = returnTo
    ? `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`
    : '/api/auth/google'

  return (
    <Button asChild variant="outline" className={className ?? 'w-full'}>
      <Link href={href} aria-label={label}>
        <svg aria-hidden="true" focusable="false" className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.29h6.47a5.53 5.53 0 0 1-2.4 3.63v3.01h3.88c2.27-2.09 3.54-5.18 3.54-8.66z"
          />
          <path
            fill="currentColor"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.93l-3.88-3.01c-1.08.72-2.46 1.14-4.05 1.14-3.12 0-5.76-2.1-6.7-4.92H1.29v3.09A12 12 0 0 0 12 24z"
          />
          <path
            fill="currentColor"
            d="M5.3 14.28A7.22 7.22 0 0 1 4.9 12c0-.79.14-1.56.4-2.28V6.63H1.29A12 12 0 0 0 0 12c0 1.95.47 3.8 1.29 5.37l4.01-3.09z"
          />
          <path
            fill="currentColor"
            d="M12 4.79c1.76 0 3.34.6 4.59 1.78l3.44-3.44C17.94 1.19 15.23 0 12 0 7.29 0 3.22 2.69 1.29 6.63l4.01 3.09C6.24 6.89 8.88 4.79 12 4.79z"
          />
        </svg>
        {label}
      </Link>
    </Button>
  )
}
