import type { AIExerciseData } from '@/types/ai'

interface CreateExerciseOptions {
  exerciseData: AIExerciseData
  lessonId?: string | null
  onError: (message: string) => void
  onSuccess: () => void
}

export async function createExerciseFromAI({
  exerciseData,
  lessonId: providedLessonId,
  onError,
  onSuccess,
}: CreateExerciseOptions): Promise<void> {
  try {
    // Use lesson from props if available, otherwise fetch first available lesson
    let lessonId = providedLessonId

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
      onError('No lessons found in database. Please create a lesson first.')
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
        lesson: lessonId,
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
      onSuccess()
      alert(
        `Exercise created successfully! ID: ${created.doc?.id || 'unknown'} (connected to lesson ${lessonId})`,
      )
    } else {
      const errorData = await response.json()
      console.error('Failed to create exercise:', errorData)
      onError(`Failed to create exercise: ${JSON.stringify(errorData, null, 2)}`)
    }
  } catch (err) {
    console.error('Failed to create exercise:', err)
    onError(`Failed to create exercise: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}
