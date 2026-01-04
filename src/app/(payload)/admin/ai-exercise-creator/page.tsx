'use client'

import { useSearchParams } from 'next/navigation'
import { useAIExerciseForm } from './useAIExerciseForm'
import { ExerciseForm } from './ExerciseForm'
import { ExerciseResults } from './ExerciseResults'
import { BackArrowIcon } from './BackArrowIcon'
import styles from './AIExerciseCreator.module.css'

export default function AIExerciseCreatorPage() {
  const searchParams = useSearchParams()
  const urlLessonId = searchParams.get('lessonId')
  const urlLessonSlug = searchParams.get('lessonSlug')
  const urlCourseSlug = searchParams.get('courseSlug')
  const urlChapterSlug = searchParams.get('chapterSlug')

  const {
    imageFile,
    imagePreview,
    prompt,
    isProcessing,
    result,
    error,
    handleImageSelect,
    handleSubmit,
    setPrompt,
  } = useAIExerciseForm({ lessonId: urlLessonId })

  const lessonUrl =
    urlCourseSlug && urlChapterSlug && urlLessonSlug
      ? `/courses/${urlCourseSlug}/chapters/${urlChapterSlug}/lessons/${urlLessonSlug}`
      : null

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

      <ExerciseForm
        onSubmit={handleSubmit}
        onImageSelect={handleImageSelect}
        imagePreview={imagePreview}
        prompt={prompt}
        onPromptChange={setPrompt}
        isProcessing={isProcessing}
        imageFile={imageFile}
      />

      {error && (
        <div className={styles.errorBanner}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && <ExerciseResults result={result} />}
    </div>
  )
}
