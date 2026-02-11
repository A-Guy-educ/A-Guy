import type { GlobalConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

const DEFAULT_TEMPLATE = `The student answered incorrectly. Here is the full question data:
{{questionData}}

The student's answer was: "{{studentAnswer}}"

Please help them understand why their answer is wrong and guide them toward the correct solution. Be encouraging and supportive.`

export const WrongAnswerPrompt: GlobalConfig = {
  slug: 'wrong-answer-prompt',
  admin: {
    group: 'AI',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: adminOnly,
  },
  fields: [
    {
      name: 'resetButton',
      type: 'ui',
      admin: {
        components: {
          Field: '@/ui/admin/WrongAnswerPrompt/ResetDefaultButton',
        },
      },
    },
    {
      name: 'template',
      type: 'textarea',
      defaultValue: DEFAULT_TEMPLATE,
      required: true,
      admin: {
        rows: 12,
        description:
          'Prompt sent to the AI when a student answers incorrectly. Use {{questionData}} and {{studentAnswer}} as placeholders.',
      },
    },
  ],
}

export { DEFAULT_TEMPLATE as WRONG_ANSWER_DEFAULT_TEMPLATE }
