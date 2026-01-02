'use client'

import { useState } from 'react'
import type { ImageToExerciseAPIResponse } from '@/types/ai'

export default function AIExerciseCreatorPage() {
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
      // Create exercise via Payload API
      const response = await fetch('/api/exercises', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: 'AI Generated Exercise',
          questionType: 'mcq',
          difficulty: 'medium',
          // Dump the entire AI response as JSON text in contentJson
          contentJson: {
            contentSchemaVersion: 1,
            stem: [
              {
                id: 'ai-generated-1',
                type: 'rich_text',
                format: 'md-math-v1',
                value: JSON.stringify(exerciseData, null, 2),
              },
            ],
          },
          answerSpecJson: {
            questionType: 'mcq',
            multiSelect: false,
            options: [
              {
                id: 'opt-1',
                content: [
                  {
                    id: 'opt-1-text',
                    type: 'rich_text',
                    format: 'md-math-v1',
                    value: 'Option A',
                  },
                ],
              },
            ],
            correctOptionIds: ['opt-1'],
          },
        }),
      })

      if (response.ok) {
        const created = await response.json()
        console.log('Exercise created:', created)
      }
    } catch (err) {
      console.error('Failed to create exercise:', err)
    }
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '10px' }}>
        AI Exercise Creator
      </h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Upload an exercise image and provide a prompt for Gemini AI to convert it to structured data
      </p>

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
          <label
            style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}
          >
            Prompt for AI
          </label>
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
