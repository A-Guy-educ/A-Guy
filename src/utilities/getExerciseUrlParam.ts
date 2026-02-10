import type { Exercise } from '@/payload-types'

export function getExerciseUrlParam(exercise: Exercise): string {
  return exercise.slug || exercise.id
}
