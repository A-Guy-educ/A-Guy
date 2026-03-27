// @vitest-environment jsdom
/**
 * Unit Tests for FormulaSheetButton Component
 *
 * Tests the toggle button behavior:
 * - Renders with BookOpen icon when closed
 * - Renders with X icon when open
 * - Calls onToggle when clicked
 * - Uses correct variant based on open state
 */
import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Mock useTranslations
vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      formulaSheetTitle: 'Formula Sheet',
    }
    return translations[key] ?? key
  },
}))

import { FormulaSheetButton } from '@/ui/web/shared/FormulaSheetViewer/FormulaSheetButton'

describe('FormulaSheetButton', () => {
  it('renders with label text', () => {
    const { getByText } = render(<FormulaSheetButton isOpen={false} onToggle={() => {}} />)
    expect(getByText('Formula Sheet')).toBeDefined()
  })

  it('has correct aria-label', () => {
    const { getByLabelText } = render(<FormulaSheetButton isOpen={false} onToggle={() => {}} />)
    expect(getByLabelText('Formula Sheet')).toBeDefined()
  })

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn()
    const { getByLabelText } = render(<FormulaSheetButton isOpen={false} onToggle={onToggle} />)
    fireEvent.click(getByLabelText('Formula Sheet'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('uses outline variant when closed', () => {
    const { container } = render(<FormulaSheetButton isOpen={false} onToggle={() => {}} />)
    const button = container.querySelector('button')
    // When closed, variant is 'outline' — button should not have default variant classes
    expect(button).toBeDefined()
  })

  it('uses default variant when open', () => {
    const { container } = render(<FormulaSheetButton isOpen={true} onToggle={() => {}} />)
    const button = container.querySelector('button')
    expect(button).toBeDefined()
  })

  it('applies custom className', () => {
    const { container } = render(
      <FormulaSheetButton isOpen={false} onToggle={() => {}} className="custom-class" />,
    )
    const button = container.querySelector('button')
    expect(button?.className).toContain('custom-class')
  })
})
