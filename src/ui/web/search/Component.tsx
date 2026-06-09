'use client'
import { Input } from '@/ui/web/components/input'
import { Label } from '@/ui/web/components/label'
import React, { useState, useEffect } from 'react'
import { useDebounce } from '@/client/hooks/useDebounce'
import { useRouter, useSearchParams } from 'next/navigation'

export const Search: React.FC = () => {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const [value, setValue] = useState(initialQuery)
  const router = useRouter()

  const debouncedValue = useDebounce(value)

  useEffect(() => {
    // Only push to router when user has actively typed something (non-empty).
    // Skip on initial mount to avoid overwriting the URL when visiting with ?q= param.
    if (debouncedValue) {
      router.push(`/search?q=${debouncedValue}`)
    } else if (initialQuery === '' && value === '') {
      // User cleared the input — navigate to clean /search
      router.push('/search')
    }
  }, [debouncedValue, router, initialQuery, value])

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <Label htmlFor="search" className="sr-only">
          Search
        </Label>
        <Input
          id="search"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
          }}
          placeholder="Search"
        />
        <button type="submit" className="sr-only">
          submit
        </button>
      </form>
    </div>
  )
}
