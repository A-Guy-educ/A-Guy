import type { Meta, StoryObj } from '@storybook/react'
import { FadeIn, StaggerGrid, StaggerItem } from './motion'

/**
 * Motion components for entrance animations.
 * FadeIn animates a single element; StaggerGrid + StaggerItem stagger children.
 */
const meta = {
  title: 'UI/Motion',
  component: FadeIn,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof FadeIn>

export default meta
type Story = StoryObj<typeof meta>

export const FadeInDefault: Story = {
  render: () => (
    <FadeIn>
      <div className="p-card-padding bg-card border rounded-lg text-card-foreground w-[300px]">
        <h3 className="font-semibold mb-2">Fade In</h3>
        <p className="text-body-sm text-muted-foreground">
          This content fades up into view on mount.
        </p>
      </div>
    </FadeIn>
  ),
}

export const FadeInWithDelay: Story = {
  render: () => (
    <div className="space-y-4">
      <FadeIn delay={0}>
        <div className="p-card-padding-sm bg-card border rounded-lg">First (no delay)</div>
      </FadeIn>
      <FadeIn delay={0.2}>
        <div className="p-card-padding-sm bg-card border rounded-lg">Second (0.2s delay)</div>
      </FadeIn>
      <FadeIn delay={0.4}>
        <div className="p-card-padding-sm bg-card border rounded-lg">Third (0.4s delay)</div>
      </FadeIn>
    </div>
  ),
}

export const StaggerGridDefault: Story = {
  render: () => (
    <StaggerGrid className="grid grid-cols-3 gap-content-gap w-[500px]">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <StaggerItem key={i}>
          <div className="p-card-padding-sm bg-card border rounded-lg text-center text-card-foreground">
            Card {i}
          </div>
        </StaggerItem>
      ))}
    </StaggerGrid>
  ),
}

export const StaggerGridTwoColumns: Story = {
  render: () => (
    <StaggerGrid className="grid grid-cols-2 gap-content-gap w-[400px]">
      {['Alpha', 'Beta', 'Gamma', 'Delta'].map((name) => (
        <StaggerItem key={name}>
          <div className="p-card-padding bg-card border rounded-lg">
            <h4 className="font-semibold text-card-foreground">{name}</h4>
            <p className="text-body-sm text-muted-foreground mt-1">Sample item</p>
          </div>
        </StaggerItem>
      ))}
    </StaggerGrid>
  ),
}
