import { useState } from 'react'
import type { ImageToExerciseAPIResponse } from '@/types/ai'
import { createExerciseFromAI } from './createExerciseFromAI'

interface UseAIExerciseFormOptions {
  lessonId?: string | null
}

export function useAIExerciseForm({ lessonId }: UseAIExerciseFormOptions) {
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
      lessonId,
      onError: setError,
      onSuccess: () => setError(null),
    })
  }

  return {
    imageFile,
    imagePreview,
    prompt,
    isProcessing,
    result,
    error,
    handleImageSelect,
    handleSubmit,
    setPrompt,
  }
}
