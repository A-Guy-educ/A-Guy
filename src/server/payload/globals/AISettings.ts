import type { GlobalConfig } from 'payload'
import { INTERACTIVE_LESSON_PROMPT } from '@/infra/llm/prompts/interactive-lesson-generation'

/**
 * AI Settings global — editable prompts and configuration for AI features.
 * Accessible at /admin/globals/ai-settings.
 */
export const AISettings: GlobalConfig = {
  slug: 'ai-settings',
  label: 'AI Settings',
  admin: {
    group: 'Settings',
    description: 'Configure AI prompts and generation settings. Changes take effect immediately.',
  },
  access: {
    read: () => true,
    update: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'interactiveLessonPrompt',
      type: 'textarea',
      label: 'Interactive Lesson Prompt',
      admin: {
        description:
          'The system prompt sent to Gemini for generating interactive lesson explanations from uploaded math images. ' +
          'Must instruct the model to return JSON with geometry + steps.',
        rows: 30,
      },
      defaultValue: INTERACTIVE_LESSON_PROMPT,
    },
  ],
}
