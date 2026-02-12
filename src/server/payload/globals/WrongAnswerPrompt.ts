import type { GlobalConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

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
      name: 'template',
      type: 'textarea',
      admin: {
        rows: 12,
        description:
          'Prompt sent to the AI when a student answers incorrectly. Use {{questionData}} and {{studentAnswer}} as placeholders. Leave empty to disable automatic help on wrong answers.',
      },
    },
  ],
}
