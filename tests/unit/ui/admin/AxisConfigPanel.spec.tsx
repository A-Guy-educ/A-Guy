// @vitest-environment jsdom

/**
 * Unit Tests for Admin AxisConfigPanel tick position toggles
 *
 * Tests that the tick position toggle checkboxes are rendered correctly
 * and properly update the spec when toggled.
 */
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import { AxisConfigPanel } from '@/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel'

// Create a minimal valid spec for testing
const createMockSpec = (overrides?: Partial<AxisSpecV1['axes']>): AxisSpecV1 => ({
  kind: 'cartesian',
  units: 1,
  grid: { enabled: true },
  axes: {
    showNumbers: true,
    showLabels: true,
    ticks: 1,
    labels: { x: 'x', y: 'y' },
    origin: { x: 0, y: 0 },
    ...overrides,
  },
  viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
  elements: {
    points: [],
    graphs: [],
  },
})

// Clean up after each test
afterEach(() => {
  cleanup()
})

describe('AxisConfigPanel tick position toggles', () => {
  it('renders invert X numbers checkbox unchecked by default', () => {
    const mockOnChange = vi.fn()
    const spec = createMockSpec()

    render(<AxisConfigPanel spec={spec} onChange={mockOnChange} />)

    const xCheckbox = screen.getByLabelText(/invert x numbers/i)
    expect(xCheckbox).toBeDefined()
    expect((xCheckbox as HTMLInputElement).checked).toBe(false)
  })

  it('renders invert Y numbers checkbox unchecked by default', () => {
    const mockOnChange = vi.fn()
    const spec = createMockSpec()

    render(<AxisConfigPanel spec={spec} onChange={mockOnChange} />)

    const yCheckbox = screen.getByLabelText(/invert y numbers/i)
    expect(yCheckbox).toBeDefined()
    expect((yCheckbox as HTMLInputElement).checked).toBe(false)
  })

  it('renders both tick position checkboxes when tickPosition is undefined', () => {
    const mockOnChange = vi.fn()
    const spec = createMockSpec()

    render(<AxisConfigPanel spec={spec} onChange={mockOnChange} />)

    expect(screen.queryByLabelText(/invert x numbers/i)).toBeDefined()
    expect(screen.queryByLabelText(/invert y numbers/i)).toBeDefined()
  })

  it('calls onChange with inverted X tickPosition when X checkbox is checked', () => {
    const mockOnChange = vi.fn()
    const spec = createMockSpec()

    render(<AxisConfigPanel spec={spec} onChange={mockOnChange} />)

    const xCheckbox = screen.getByLabelText(/invert x numbers/i)
    fireEvent.click(xCheckbox)

    expect(mockOnChange).toHaveBeenCalledTimes(1)
    const updatedSpec = mockOnChange.mock.calls[0][0]
    expect(updatedSpec.axes.tickPosition).toEqual({
      x: 'inverted',
      y: 'default',
    })
  })

  it('calls onChange with default X tickPosition when X checkbox is unchecked', () => {
    const mockOnChange = vi.fn()
    const spec = createMockSpec({
      tickPosition: { x: 'inverted', y: 'default' },
    })

    render(<AxisConfigPanel spec={spec} onChange={mockOnChange} />)

    const xCheckbox = screen.getByLabelText(/invert x numbers/i)
    fireEvent.click(xCheckbox)

    expect(mockOnChange).toHaveBeenCalledTimes(1)
    const updatedSpec = mockOnChange.mock.calls[0][0]
    expect(updatedSpec.axes.tickPosition).toEqual({
      x: 'default',
      y: 'default',
    })
  })

  it('calls onChange with inverted Y tickPosition when Y checkbox is checked', () => {
    const mockOnChange = vi.fn()
    const spec = createMockSpec()

    render(<AxisConfigPanel spec={spec} onChange={mockOnChange} />)

    const yCheckbox = screen.getByLabelText(/invert y numbers/i)
    fireEvent.click(yCheckbox)

    expect(mockOnChange).toHaveBeenCalledTimes(1)
    const updatedSpec = mockOnChange.mock.calls[0][0]
    expect(updatedSpec.axes.tickPosition).toEqual({
      x: 'default',
      y: 'inverted',
    })
  })

  it('calls onChange with default Y tickPosition when Y checkbox is unchecked', () => {
    const mockOnChange = vi.fn()
    const spec = createMockSpec({
      tickPosition: { x: 'default', y: 'inverted' },
    })

    render(<AxisConfigPanel spec={spec} onChange={mockOnChange} />)

    const yCheckbox = screen.getByLabelText(/invert y numbers/i)
    fireEvent.click(yCheckbox)

    expect(mockOnChange).toHaveBeenCalledTimes(1)
    const updatedSpec = mockOnChange.mock.calls[0][0]
    expect(updatedSpec.axes.tickPosition).toEqual({
      x: 'default',
      y: 'default',
    })
  })

  it('renders invert X numbers checkbox checked when spec has inverted X', () => {
    const mockOnChange = vi.fn()
    const spec = createMockSpec({
      tickPosition: { x: 'inverted', y: 'default' },
    })

    render(<AxisConfigPanel spec={spec} onChange={mockOnChange} />)

    const xCheckbox = screen.getByLabelText(/invert x numbers/i)
    expect((xCheckbox as HTMLInputElement).checked).toBe(true)
  })

  it('renders invert Y numbers checkbox checked when spec has inverted Y', () => {
    const mockOnChange = vi.fn()
    const spec = createMockSpec({
      tickPosition: { x: 'default', y: 'inverted' },
    })

    render(<AxisConfigPanel spec={spec} onChange={mockOnChange} />)

    const yCheckbox = screen.getByLabelText(/invert y numbers/i)
    expect((yCheckbox as HTMLInputElement).checked).toBe(true)
  })

  it('preserves Y position when toggling X position', () => {
    const mockOnChange = vi.fn()
    const spec = createMockSpec({
      tickPosition: { x: 'default', y: 'inverted' },
    })

    render(<AxisConfigPanel spec={spec} onChange={mockOnChange} />)

    const xCheckbox = screen.getByLabelText(/invert x numbers/i)
    fireEvent.click(xCheckbox)

    const updatedSpec = mockOnChange.mock.calls[0][0]
    // Y should still be inverted
    expect(updatedSpec.axes.tickPosition?.y).toBe('inverted')
    // X should now be inverted
    expect(updatedSpec.axes.tickPosition?.x).toBe('inverted')
  })

  it('preserves X position when toggling Y position', () => {
    const mockOnChange = vi.fn()
    const spec = createMockSpec({
      tickPosition: { x: 'inverted', y: 'default' },
    })

    render(<AxisConfigPanel spec={spec} onChange={mockOnChange} />)

    const yCheckbox = screen.getByLabelText(/invert y numbers/i)
    fireEvent.click(yCheckbox)

    const updatedSpec = mockOnChange.mock.calls[0][0]
    // X should still be inverted
    expect(updatedSpec.axes.tickPosition?.x).toBe('inverted')
    // Y should now be inverted
    expect(updatedSpec.axes.tickPosition?.y).toBe('inverted')
  })

  it('renders tick position checkboxes alongside existing checkboxes', () => {
    const mockOnChange = vi.fn()
    const spec = createMockSpec()

    render(<AxisConfigPanel spec={spec} onChange={mockOnChange} />)

    // Existing checkboxes should still be present
    expect(screen.queryByLabelText(/grid/i)).toBeDefined()
    expect(screen.queryByLabelText(/^numbers$/i)).toBeDefined()
    expect(screen.queryByLabelText(/labels/i)).toBeDefined()
    // New tick position checkboxes
    expect(screen.queryByLabelText(/invert x numbers/i)).toBeDefined()
    expect(screen.queryByLabelText(/invert y numbers/i)).toBeDefined()
  })
})
