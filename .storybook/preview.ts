import type { Preview } from '@storybook/react'
import '../src/app/globals.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: 'hsl(220 40% 97%)' },
        { name: 'dark', value: 'hsl(220 40% 8%)' },
      ],
    },
    theme: 'light',
  },
}

export default preview
