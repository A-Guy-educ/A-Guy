import type { Meta, StoryObj } from '@storybook/react'
import { AccentPicker } from './accent-picker'

/**
 * AccentPicker component for selecting a theme accent color.
 * Persists selection to localStorage and applies CSS custom properties.
 */
const meta = {
  title: 'UI/AccentPicker',
  component: AccentPicker,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof AccentPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-content-gap">
      <span className="text-body-sm font-medium text-foreground">Accent Color</span>
      <AccentPicker />
    </div>
  ),
}
