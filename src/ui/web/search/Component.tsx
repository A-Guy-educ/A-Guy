'use client'
import { Input } from '@/ui/web/components/input'
import { Label } from '@/ui/web/components/label'
import React, { useState, useEffect } from 'react'
import { useDebounce } from '@/client/hooks/useDebounce'
import { useRouter } from 'next/navigation'

export const Search: React.FC = () => {
  const [value, setValue] = useState('')
  const router = useRouter()

  const debouncedValue = useDebounce(value)

  useEffect(() => {
    router.push(`/search${debouncedValue ? `?q=${debouncedValue}` : ''}`)
  }, [debouncedValue, router])

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          // Immediately navigate on form submit (Enter or submit button)
          // rather than waiting for debounce delay
          const query = value.trim()
          if (query) {
            router.push(`/search?q=${encodeURIComponent(query)}`)
          }
        }}
      >
        <Label htmlFor="search" className="sr-only">
          Search
        </Label>
        <Input
          id="search"
          name="search"
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
