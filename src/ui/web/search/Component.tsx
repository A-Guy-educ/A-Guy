'use client'
import { Input } from '@/ui/web/components/input'
import { Label } from '@/ui/web/components/label'
import React, { useState, useEffect, useRef } from 'react'
import { useDebounce } from '@/client/hooks/useDebounce'
import { useRouter } from 'next/navigation'

export const Search: React.FC = () => {
  const [value, setValue] = useState('')
  const router = useRouter()
  const routerRef = useRef(router)

  // Keep router ref stable across renders
  useEffect(() => {
    routerRef.current = router
  }, [router])

  const debouncedValue = useDebounce(value)

  useEffect(() => {
    routerRef.current.push(`/search${debouncedValue ? `?q=${debouncedValue}` : ''}`)
  }, [debouncedValue])

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
