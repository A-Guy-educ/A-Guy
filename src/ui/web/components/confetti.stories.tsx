'use client'

import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Confetti } from './confetti'
import { Button } from './button'

/**
 * Confetti animation component for celebrations.
 * Toggle the `active` prop to trigger the effect.
 */
const meta = {
  title: 'UI/Confetti',
  component: Confetti,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Confetti>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: function ConfettiStory() {
    const [active, setActive] = useState(false)

    const trigger = () => {
      setActive(false)
      // Reset on next tick to re-trigger the effect
      requestAnimationFrame(() => setActive(true))
    }

    return (
      <div className="flex flex-col items-center gap-content-gap">
        <Button onClick={trigger}>Launch Confetti</Button>
        <Confetti active={active} />
      </div>
    )
  },
}

export const LongDuration: Story = {
  render: function ConfettiLongStory() {
    const [active, setActive] = useState(false)

    const trigger = () => {
      setActive(false)
      requestAnimationFrame(() => setActive(true))
    }

    return (
      <div className="flex flex-col items-center gap-content-gap">
        <Button onClick={trigger}>Launch Confetti (5s)</Button>
        <Confetti active={active} duration={5000} />
      </div>
    )
  },
}
