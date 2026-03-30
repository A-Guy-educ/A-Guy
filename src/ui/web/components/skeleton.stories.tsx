import type { Meta, StoryObj } from '@storybook/react'
import { Skeleton, SkeletonText, SkeletonCard } from './skeleton'

/**
 * Skeleton components for showing loading placeholders.
 * Includes single-line skeleton, multi-line text skeleton, and card skeleton.
 */
const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    className: 'h-4 w-[250px]',
  },
}

export const Circle: Story = {
  args: {
    className: 'h-12 w-12 rounded-full',
  },
}

export const TextTwoLines: Story = {
  render: () => (
    <div className="w-[300px]">
      <SkeletonText lines={2} />
    </div>
  ),
}

export const TextThreeLines: Story = {
  render: () => (
    <div className="w-[300px]">
      <SkeletonText lines={3} />
    </div>
  ),
}

export const TextFiveLines: Story = {
  render: () => (
    <div className="w-[300px]">
      <SkeletonText lines={5} />
    </div>
  ),
}

export const CardSkeleton: Story = {
  render: () => (
    <div className="w-[350px]">
      <SkeletonCard />
    </div>
  ),
}

export const CardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-content-gap w-[500px]">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  ),
}
