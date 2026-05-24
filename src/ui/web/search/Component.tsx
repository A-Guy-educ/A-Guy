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
    <form
      onSubmit={(e) => {
        e.preventDefault()
      }}
      className="flex gap-2"
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
        className="flex-1"
      />
      <button
        type="submit"
        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-[0.875rem] leading-[1.5] font-medium ring-offset-background transition-all duration-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] will-change-transform bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-elevation-1 hover:scale-[1.02] h-10 px-4 py-2"
      >
        Search
      </button>
    </form>
  )
}
