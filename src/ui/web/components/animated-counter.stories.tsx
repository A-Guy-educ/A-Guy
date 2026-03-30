import type { Meta, StoryObj } from '@storybook/react'
import { AnimatedCounter } from './animated-counter'

/**
 * AnimatedCounter component for animating numeric values.
 * Counts up from 0 when scrolled into view.
 */
const meta = {
  title: 'UI/AnimatedCounter',
  component: AnimatedCounter,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof AnimatedCounter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: 42,
    className: 'text-display-xl font-bold',
  },
}

export const LargeNumber: Story = {
  args: {
    value: 1250,
    className: 'text-display-xl font-bold',
  },
}

export const WithSuffix: Story = {
  args: {
    value: 99,
    suffix: '%',
    className: 'text-display-xl font-bold',
  },
}

export const WithPrefix: Story = {
  args: {
    value: 500,
    prefix: '$',
    className: 'text-display-xl font-bold',
  },
}

export const SlowDuration: Story = {
  args: {
    value: 100,
    duration: 3,
    className: 'text-display-xl font-bold',
  },
}

export const MultipleCounters: Story = {
  render: () => (
    <div className="flex gap-content-gap-xl">
      <div className="text-center">
        <AnimatedCounter value={128} className="text-display-xl font-bold" />
        <p className="text-body-sm text-muted-foreground mt-1">Projects</p>
      </div>
      <div className="text-center">
        <AnimatedCounter value={94} suffix="%" className="text-display-xl font-bold" />
        <p className="text-body-sm text-muted-foreground mt-1">Uptime</p>
      </div>
      <div className="text-center">
        <AnimatedCounter value={2400} prefix="$" className="text-display-xl font-bold" />
        <p className="text-body-sm text-muted-foreground mt-1">Revenue</p>
      </div>
    </div>
  ),
}
