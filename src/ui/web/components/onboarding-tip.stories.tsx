import type { Meta, StoryObj } from '@storybook/react'
import { OnboardingTip } from './onboarding-tip'
import { Button } from './button'

/**
 * OnboardingTip component for showing contextual tips around UI elements.
 * Tips are dismissible and persist dismissal state in localStorage.
 */
const meta = {
  title: 'UI/OnboardingTip',
  component: OnboardingTip,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof OnboardingTip>

export default meta
type Story = StoryObj<typeof meta>

export const Bottom: Story = {
  args: {
    id: 'story-tip-bottom',
    tip: 'Click this button to get started!',
    position: 'bottom',
    children: <Button>Get Started</Button>,
  },
}

export const Top: Story = {
  args: {
    id: 'story-tip-top',
    tip: 'This is a helpful tip above the button.',
    position: 'top',
    children: <Button variant="outline">Settings</Button>,
  },
}

export const Start: Story = {
  args: {
    id: 'story-tip-start',
    tip: 'Tip appearing on the start side.',
    position: 'start',
    children: <Button variant="secondary">Action</Button>,
  },
}

export const End: Story = {
  args: {
    id: 'story-tip-end',
    tip: 'Tip appearing on the end side.',
    position: 'end',
    children: <Button variant="ghost">More Info</Button>,
  },
}
