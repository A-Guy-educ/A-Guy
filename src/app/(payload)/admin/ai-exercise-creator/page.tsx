'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ImageToExerciseAPIResponse } from '@/types/ai'
import { createExerciseFromAI } from './createExerciseFromAI'
import { BackArrowIcon } from './BackArrowIcon'
import styles from './AIExerciseCreator.module.css'

export default function AIExerciseCreatorPage() {
  const searchParams = useSearchParams()
  const urlLessonId = searchParams.get('lessonId')
  const urlLessonSlug = searchParams.get('lessonSlug')
  const urlCourseSlug = searchParams.get('courseSlug')
  const urlChapterSlug = searchParams.get('chapterSlug')

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ImageToExerciseAPIResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setImagePreview(e.target?.result as string)
      reader.readAsDataURL(file)
      setResult(null)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!imageFile) {
      setError('Please select an image')
      return
    }

    if (!prompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    setIsProcessing(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('accompanyingText', prompt)

      const response = await fetch('/api/ai/image-to-exercise', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      const data: ImageToExerciseAPIResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process image')
      }

      setResult(data)

      // Auto-create exercise with the result
      if (data.data) {
        await createExercise(data.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  const createExercise = async (exerciseData: any) => {
    await createExerciseFromAI({
      exerciseData,
      lessonId: urlLessonId,
      onError: setError,
      onSuccess: () => setError(null),
    })
  }

  const lessonUrl =
    urlCourseSlug && urlChapterSlug && urlLessonSlug
      ? `/courses/${urlCourseSlug}/chapters/${urlChapterSlug}/lessons/${urlLessonSlug}`
      : null

  const samplePrompt =
    'Extract this exercise completely with all parts (א, ב, ג, etc.). Convert all math symbols to LaTeX format ($x^2$, $\\frac{a}{b}$). Return as JSON with question, options (if any), correct answer index, and explanation.'

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>AI Exercise Creator</h1>
        {lessonUrl && (
          <a href={lessonUrl} className={styles.backButton}>
            <BackArrowIcon className={styles.backIcon} />
            Back to Lesson
          </a>
        )}
      </div>

      <p className={styles.description}>
        Upload an exercise image and provide a prompt for Gemini AI to convert it to structured data
      </p>

      {urlLessonSlug && (
        <div className={styles.lessonInfo}>
          <strong>Creating exercise for lesson:</strong> {urlLessonSlug}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Exercise Image</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleImageSelect}
            className={styles.fileInput}
          />
        </div>

        {imagePreview && (
          <div className={styles.previewContainer}>
            <img src={imagePreview} alt="Preview" className={styles.preview} />
          </div>
        )}

        <div className={styles.formGroup}>
          <div className={styles.labelRow}>
            <label className={styles.label}>Prompt for AI</label>
            <button
              type="button"
              onClick={() => setPrompt(samplePrompt)}
              className={styles.sampleButton}
            >
              Use Sample Prompt
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Example: Extract this math exercise and return it as JSON with question, options, and correct answer..."
            rows={4}
            className={styles.textarea}
          />
        </div>

        <button
          type="submit"
          disabled={isProcessing || !imageFile || !prompt.trim()}
          className={styles.submitButton}
        >
          {isProcessing ? 'Processing...' : 'Generate Exercise'}
        </button>
      </form>

      {error && (
        <div className={styles.errorBanner}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && result.success && result.data && (
        <div className={styles.resultsSection}>
          <h2 className={styles.resultsTitle}>Exercise Created Successfully!</h2>

          <div className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <span className={styles.resultLabel}>Question</span>
            </div>
            <p className={styles.resultValue}>{result.data.question}</p>
          </div>

          <div className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <span className={styles.resultLabel}>Options</span>
            </div>
            <ul className={styles.resultValue}>
              {result.data.options.map((opt, i) => (
                <li
                  key={i}
                  style={{ fontWeight: i === result.data?.correctAnswer ? 'bold' : 'normal' }}
                >
                  {opt} {i === result.data?.correctAnswer && '✓ (Correct)'}
                </li>
              ))}
            </ul>
          </div>

          {result.data.explanation && (
            <div className={styles.resultCard}>
              <div className={styles.resultHeader}>
                <span className={styles.resultLabel}>Explanation</span>
              </div>
              <p className={styles.resultValue}>{result.data.explanation}</p>
            </div>
          )}

          <div className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <span className={styles.resultLabel}>Full JSON Response</span>
              <button type="button" className={styles.jsonToggle}>
                View JSON
              </button>
            </div>
            <pre className={styles.jsonBlock}>{JSON.stringify(result, null, 2)}</pre>
          </div>

          <p className={styles.resultValue}>
            Processing time: {result.metadata?.processingTimeMs}ms | Model: {result.metadata?.model}
          </p>
        </div>
      )}
    </div>
  )
}
