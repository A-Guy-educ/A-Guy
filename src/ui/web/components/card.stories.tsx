import type { Meta, StoryObj } from '@storybook/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card'
import { Button } from './button'

/**
 * Card component for grouping related content with optional header, body, and footer.
 * Uses design tokens for consistent spacing and elevation.
 */
const meta = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content with some sample text to demonstrate the layout.</p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">
          Cancel
        </Button>
        <Button size="sm" className="ml-auto">
          Save
        </Button>
      </CardFooter>
    </Card>
  ),
}

export const HeaderOnly: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>You have 3 unread messages.</CardDescription>
      </CardHeader>
    </Card>
  ),
}

export const ContentOnly: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardContent className="pt-6">
        <p>A simple card with only content and no header or footer.</p>
      </CardContent>
    </Card>
  ),
}

export const Hoverable: Story = {
  render: () => (
    <Card className="w-[350px] cursor-pointer hover:shadow-elevation-2 hover:border-primary/30">
      <CardHeader>
        <CardTitle>Hoverable Card</CardTitle>
        <CardDescription>Hover over this card to see the effect.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card has hover styles for interactive use cases like links or clickable items.</p>
      </CardContent>
    </Card>
  ),
}

export const FullComposition: Story = {
  render: () => (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Create Project</CardTitle>
        <CardDescription>Deploy your new project in one click.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-body-sm text-muted-foreground">Project Name</div>
        <div className="h-10 w-full rounded-md border bg-form px-3 py-2 text-body-sm">
          my-project
        </div>
        <div className="text-body-sm text-muted-foreground">Framework</div>
        <div className="h-10 w-full rounded-md border bg-form px-3 py-2 text-body-sm">Next.js</div>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost">Cancel</Button>
        <Button>Deploy</Button>
      </CardFooter>
    </Card>
  ),
}
