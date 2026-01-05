'use client'

import { useState } from 'react'
import styles from './LessonContent.module.css'

interface ConvertButtonProps {
  lessonId: string
}

export function ConvertButton({ lessonId }: ConvertButtonProps) {
  const [isConverting, setIsConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleConvert = async () => {
    setIsConverting(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/ai/convert-lesson-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ lessonId }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to convert image')
      }

      setSuccess(true)
      // Reload the page to show the new exercise
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <div className={styles.convertSection}>
      <button onClick={handleConvert} disabled={isConverting} className={styles.convertButton}>
        {isConverting ? 'Converting...' : '🪄 Convert to Exercise (AI)'}
      </button>

      {error && <div className={styles.convertError}>{error}</div>}

      {success && (
        <div className={styles.convertSuccess}>✅ Exercise created! Refreshing page...</div>
      )}
    </div>
  )
}
