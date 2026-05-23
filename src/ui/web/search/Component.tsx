'use client'
import { Input } from '@/ui/web/components/input'
import { Label } from '@/ui/web/components/label'
import React, { useState, useEffect, useRef } from 'react'
import { useDebounce } from '@/client/hooks/useDebounce'
import { useRouter, useSearchParams } from 'next/navigation'

export const Search: React.FC = () => {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const [value, setValue] = useState(initialQuery)
  const router = useRouter()
  const hasMounted = useRef(false)

  const debouncedValue = useDebounce(value)

  useEffect(() => {
    // Skip initial mount - the URL is already correct from server render
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }

    const newUrl = debouncedValue ? `/search?q=${debouncedValue}` : '/search'
    router.push(newUrl)
  }, [debouncedValue, router])

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
