'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './LessonContent.module.css'

interface ConvertButtonProps {
  lessonId: string
}

export function ConvertButton({ lessonId }: ConvertButtonProps) {
  const router = useRouter()
  const [isConverting, setIsConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConvert = async () => {
    setIsConverting(true)
    setError(null)

    try {
      const response = await fetch(`/api/exercises/import?lessonId=${lessonId}`, {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to convert image')
      }

      // Success! Refresh the page to show the new exercise
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsConverting(false)
    }
  }

  return (
    <div className={styles.convertSection}>
      <button onClick={handleConvert} disabled={isConverting} className={styles.convertButton}>
        {isConverting ? '🔄 Converting...' : '🪄 Convert to Exercise (AI)'}
      </button>

      {error && <div className={styles.convertError}>{error}</div>}
    </div>
  )
}
