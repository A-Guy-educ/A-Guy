'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ImageToExerciseAPIResponse } from '@/types/ai'

export default function AIExerciseCreatorPage() {
  const searchParams = useSearchParams()
  const urlLessonId = searchParams.get('lessonId')
  const urlLessonSlug = searchParams.get('lessonSlug')

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
    try {
      // Use lesson from URL if available, otherwise fetch first available lesson
      let lessonId = urlLessonId

      if (!lessonId) {
        const lessonsResponse = await fetch('/api/lessons?limit=1', {
          credentials: 'include',
        })

        if (lessonsResponse.ok) {
          const lessonsData = await lessonsResponse.json()
          if (lessonsData.docs && lessonsData.docs.length > 0) {
            lessonId = lessonsData.docs[0].id
          }
        }
      }

      if (!lessonId) {
        setError('No lessons found in database. Please create a lesson first.')
        return
      }

      // Determine question type based on whether we have options
      const hasOptions = exerciseData.options && exerciseData.options.length > 0
      const questionType = hasOptions ? 'mcq' : 'free_response'

      // Build answer spec based on question type
      let answerSpecJson
      if (hasOptions) {
        answerSpecJson = {
          questionType: 'mcq',
          multiSelect: false,
          options: exerciseData.options.map((opt: string, i: number) => ({
            id: `opt-${i + 1}`,
            content: [
              {
                id: `opt-${i + 1}-text`,
                type: 'rich_text',
                format: 'md-math-v1',
                value: opt,
              },
            ],
          })),
          correctOptionIds:
            exerciseData.correctAnswer !== null && exerciseData.correctAnswer !== undefined
              ? [`opt-${exerciseData.correctAnswer + 1}`]
              : ['opt-1'],
        }
      } else {
        // Free response requires responseKind and acceptedAnswers
        answerSpecJson = {
          questionType: 'free_response',
          responseKind: 'text',
          acceptedAnswers: [exerciseData.explanation || 'See solution'],
        }
      }

      // Create exercise via Payload API
      const response = await fetch('/api/exercises', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: 'AI Generated Exercise',
          questionType,
          order: 0,
          lesson: lessonId, // Field name is 'lesson' not 'lessonId'
          // New content structure: { blocks: [...] }
          content: {
            blocks: [
              {
                id: 'ai-generated-1',
                type: 'rich_text',
                format: 'md-math-v1',
                value: `${exerciseData.question}\n\n---\n**Full AI Response:**\n\`\`\`json\n${JSON.stringify(exerciseData, null, 2)}\n\`\`\``,
                mediaIds: [],
              },
            ],
          },
          answerSpecJson,
        }),
      })

      if (response.ok) {
        const created = await response.json()
        console.log('Exercise created:', created)
        setError(null)
        alert(
          `Exercise created successfully! ID: ${created.doc?.id || 'unknown'} (connected to lesson ${lessonId})`,
        )
      } else {
        const errorData = await response.json()
        console.error('Failed to create exercise:', errorData)
        setError(`Failed to create exercise: ${JSON.stringify(errorData, null, 2)}`)
      }
    } catch (err) {
      console.error('Failed to create exercise:', err)
      setError(`Failed to create exercise: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '10px' }}>
        AI Exercise Creator
      </h1>
      <p style={{ color: '#666', marginBottom: '10px' }}>
        Upload an exercise image and provide a prompt for Gemini AI to convert it to structured data
      </p>
      {urlLessonSlug && (
        <div
          style={{
            background: '#e3f2fd',
            border: '1px solid #2196f3',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            color: '#1565c0',
          }}
        >
          <strong>Creating exercise for lesson:</strong> {urlLessonSlug}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}
          >
            Exercise Image
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleImageSelect}
            style={{
              padding: '10px',
              border: '2px dashed #ddd',
              borderRadius: '8px',
              width: '100%',
              cursor: 'pointer',
            }}
          />
        </div>

        {imagePreview && (
          <div style={{ marginBottom: '20px' }}>
            <img
              src={imagePreview}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '400px',
                border: '1px solid #ddd',
                borderRadius: '8px',
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <label style={{ fontWeight: '600', fontSize: '14px' }}>Prompt for AI</label>
            <button
              type="button"
              onClick={() =>
                setPrompt(
                  'Extract this exercise completely with all parts (א, ב, ג, etc.). Convert all math symbols to LaTeX format ($x^2$, $\\frac{a}{b}$). Return as JSON with question, options (if any), correct answer index, and explanation.',
                )
              }
              style={{
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
                color: '#374151',
              }}
            >
              Use Sample Prompt
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Example: Extract this math exercise and return it as JSON with question, options, and correct answer..."
            rows={4}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isProcessing || !imageFile || !prompt.trim()}
          style={{
            background: isProcessing ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
          }}
        >
          {isProcessing ? 'Processing...' : 'Generate Exercise'}
        </button>
      </form>

      {error && (
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            color: '#c00',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && result.success && result.data && (
        <div
          style={{
            marginTop: '20px',
            padding: '20px',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
          }}
        >
          <h2
            style={{ fontSize: '20px', fontWeight: '600', marginBottom: '15px', color: '#0c4a6e' }}
          >
            Exercise Created Successfully!
          </h2>

          <div style={{ marginBottom: '15px' }}>
            <strong>Question:</strong>
            <p style={{ marginTop: '5px' }}>{result.data.question}</p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong>Options:</strong>
            <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
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
            <div style={{ marginBottom: '15px' }}>
              <strong>Explanation:</strong>
              <p style={{ marginTop: '5px' }}>{result.data.explanation}</p>
            </div>
          )}

          <details style={{ marginTop: '20px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600' }}>
              View Full JSON Response
            </summary>
            <pre
              style={{
                marginTop: '10px',
                padding: '15px',
                background: '#1e293b',
                color: '#e2e8f0',
                borderRadius: '8px',
                overflow: 'auto',
                fontSize: '12px',
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>

          <div style={{ marginTop: '15px', fontSize: '13px', color: '#666' }}>
            Processing time: {result.metadata?.processingTimeMs}ms | Model: {result.metadata?.model}
          </div>
        </div>
      )}
    </div>
  )
}
