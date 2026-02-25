import type { Block } from 'payload'

export const ExerciseRefBlock: Block = {
  slug: 'exerciseRef',
  interfaceName: 'ExerciseRefBlock',
  labels: {
    singular: 'Exercise',
    plural: 'Exercises',
  },
  fields: [
    {
      name: 'exercise',
      type: 'relationship',
      relationTo: 'exercises',
      required: true,
      admin: {
        description: 'Reference to an exercise',
      },
    },
  ],
}
