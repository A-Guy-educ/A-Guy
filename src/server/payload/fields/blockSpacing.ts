import type { Field } from 'payload'

export const SPACING_VALUES = ['none', 'small', 'medium', 'large', 'xlarge'] as const
export type SpacingValue = (typeof SPACING_VALUES)[number]

export const SPACING_OPTIONS: { label: string; value: SpacingValue }[] = [
  { label: 'None', value: 'none' },
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large (Default)', value: 'large' },
  { label: 'Extra Large', value: 'xlarge' },
]

export const SPACING_CLASS_MAP: Record<SpacingValue, string> = {
  none: 'my-0',
  small: 'my-4',
  medium: 'my-8',
  large: 'my-16',
  xlarge: 'my-24',
}

export function resolveSpacingClass(
  blockSpacing: string | null | undefined,
  pageDefault: string | null | undefined,
): string {
  const effective =
    blockSpacing && blockSpacing !== 'inherit' ? blockSpacing : (pageDefault ?? 'large')
  return SPACING_CLASS_MAP[effective as SpacingValue] ?? SPACING_CLASS_MAP.large
}

export const blockSpacingField: Field = {
  type: 'collapsible',
  label: 'Layout Settings',
  admin: {
    initCollapsed: true,
  },
  fields: [
    {
      name: 'spacingAfter',
      type: 'select',
      defaultValue: 'inherit',
      options: [{ label: 'Inherit from Page', value: 'inherit' }, ...SPACING_OPTIONS],
      admin: {
        description: 'Override the page default spacing after this block',
      },
    },
  ],
}

export const pageDefaultSpacingField: Field = {
  name: 'defaultBlockSpacing',
  type: 'select',
  defaultValue: 'large',
  options: SPACING_OPTIONS,
  admin: {
    position: 'sidebar',
    description: 'Default vertical spacing between layout blocks',
  },
}
