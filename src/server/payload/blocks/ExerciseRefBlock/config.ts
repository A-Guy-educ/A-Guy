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
      filterOptions: ({ data }) => {
        // Only show exercises that belong to this lesson
        if (data?.id) {
          return { lesson: { equals: data.id } }
        }
        return true
      },
      admin: {
        description: 'Reference to an exercise belonging to this lesson',
      },
    },
  ],
}
