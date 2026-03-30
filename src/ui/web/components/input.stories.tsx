import type { Meta, StoryObj } from '@storybook/react'
import { Input } from './input'

/**
 * Input component for text entry.
 * Uses design tokens for consistent form styling.
 */
const meta = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    type: 'text',
  },
}

export const WithPlaceholder: Story = {
  args: {
    type: 'email',
    placeholder: 'Enter your email',
  },
}

export const Disabled: Story = {
  args: {
    type: 'text',
    placeholder: 'Disabled input',
    disabled: true,
  },
}

export const WithValue: Story = {
  args: {
    type: 'text',
    defaultValue: 'Hello world',
  },
}

export const ErrorState: Story = {
  render: () => (
    <div className="space-y-1.5 w-[300px]">
      <Input
        type="text"
        placeholder="Enter username"
        className="border-destructive focus-visible:ring-destructive"
        defaultValue="ab"
      />
      <p className="text-body-xs text-destructive">Username must be at least 3 characters.</p>
    </div>
  ),
}

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter your password',
  },
}
