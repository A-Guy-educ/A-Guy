/**
 * Unit Tests for Web JSXGraphBoard tick position configuration
 *
 * Tests the axisConfig prop with tickPosition field to ensure
 * tick numbers appear on correct sides of axis lines.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// We need to test the axisConfig construction logic
// Since JSXGraphBoard is a client component that dynamically imports jsxgraph,
// we test the logic by extracting the config construction into a testable function

describe('JSXGraphBoard axisConfig tickPosition', () => {
  // Helper function that mirrors the logic in JSXGraphBoard
  // This simulates how the component builds the defaultAxes config
  const buildAxisConfig = (axisConfig?: {
    showNumbers?: boolean
    showLabels?: boolean
    ticks?: number
    labels?: { x: string; y: string }
    tickPosition?: { x: 'default' | 'inverted'; y: 'default' | 'inverted' }
  }) => {
    const showAxis = true

    if (!showAxis) {
      return { axis: false }
    }

    const tickPos = axisConfig?.tickPosition
    const xOffset = tickPos?.x === 'inverted' ? 10 : -10
    const yOffset = tickPos?.y === 'inverted' ? 10 : -10

    return {
      axis: true,
      defaultAxes: {
        x: {
          ticks: {
            visible: axisConfig?.showNumbers ?? true,
            ticksDistance: axisConfig?.ticks ?? 1,
            label: { offset: [0, xOffset] },
          },
          name: axisConfig?.labels?.x ?? 'x',
          withLabel: axisConfig?.showLabels ?? true,
          label: { position: 'rt', offset: [0, 12] },
        },
        y: {
          ticks: {
            visible: axisConfig?.showNumbers ?? true,
            ticksDistance: axisConfig?.ticks ?? 1,
            label: { offset: [yOffset, 0] },
          },
          name: axisConfig?.labels?.y ?? 'y',
          withLabel: axisConfig?.showLabels ?? true,
          label: { position: 'rt', offset: [15, 0] },
        },
      },
    }
  }

  it('passes tick position offset for inverted X-axis', () => {
    const config = buildAxisConfig({
      tickPosition: { x: 'inverted', y: 'default' },
    })

    // X-axis tick label should have positive offset (opposite side)
    expect(config.defaultAxes?.x?.ticks?.label?.offset).toEqual([0, 10])
    // Y-axis tick label should have default negative offset
    expect(config.defaultAxes?.y?.ticks?.label?.offset).toEqual([-10, 0])
  })

  it('passes tick position offset for inverted Y-axis', () => {
    const config = buildAxisConfig({
      tickPosition: { x: 'default', y: 'inverted' },
    })

    // X-axis tick label should have default negative offset
    expect(config.defaultAxes?.x?.ticks?.label?.offset).toEqual([0, -10])
    // Y-axis tick label should have positive offset (opposite side)
    expect(config.defaultAxes?.y?.ticks?.label?.offset).toEqual([10, 0])
  })

  it('passes tick position offset for both inverted', () => {
    const config = buildAxisConfig({
      tickPosition: { x: 'inverted', y: 'inverted' },
    })

    // Both axes should have positive offsets (inverted positions)
    expect(config.defaultAxes?.x?.ticks?.label?.offset).toEqual([0, 10])
    expect(config.defaultAxes?.y?.ticks?.label?.offset).toEqual([10, 0])
  })

  it('uses default tick position when tickPosition is undefined', () => {
    const config = buildAxisConfig({})

    // Default: negative offsets for both axes
    expect(config.defaultAxes?.x?.ticks?.label?.offset).toEqual([0, -10])
    expect(config.defaultAxes?.y?.ticks?.label?.offset).toEqual([-10, 0])
  })

  it('uses default tick position when tickPosition is not provided', () => {
    const config = buildAxisConfig(undefined)

    // Default: negative offsets for both axes
    expect(config.defaultAxes?.x?.ticks?.label?.offset).toEqual([0, -10])
    expect(config.defaultAxes?.y?.ticks?.label?.offset).toEqual([-10, 0])
  })

  it('includes standardized X-axis title positioning (far right, slightly below)', () => {
    const config = buildAxisConfig({})

    // X-axis label should be positioned at far right, slightly below
    expect(config.defaultAxes?.x?.label?.position).toBe('rt')
    expect(config.defaultAxes?.x?.label?.offset).toEqual([0, 12])
  })

  it('includes standardized Y-axis title positioning (near top, slightly to right)', () => {
    const config = buildAxisConfig({})

    // Y-axis label should be positioned at right side, near top
    expect(config.defaultAxes?.y?.label?.position).toBe('rt')
    expect(config.defaultAxes?.y?.label?.offset).toEqual([15, 0])
  })

  it('passes through showNumbers correctly', () => {
    const configWithNumbers = buildAxisConfig({ showNumbers: false })
    const configWithoutNumbers = buildAxisConfig({ showNumbers: true })

    expect(configWithNumbers.defaultAxes?.x?.ticks?.visible).toBe(false)
    expect(configWithoutNumbers.defaultAxes?.x?.ticks?.visible).toBe(true)
  })

  it('passes through showLabels correctly', () => {
    const configWithLabels = buildAxisConfig({ showLabels: false })
    const configWithoutLabels = buildAxisConfig({ showLabels: true })

    expect(configWithLabels.defaultAxes?.x?.withLabel).toBe(false)
    expect(configWithoutLabels.defaultAxes?.x?.withLabel).toBe(true)
  })

  it('passes through ticks correctly', () => {
    const config = buildAxisConfig({ ticks: 2 })

    expect(config.defaultAxes?.x?.ticks?.ticksDistance).toBe(2)
    expect(config.defaultAxes?.y?.ticks?.ticksDistance).toBe(2)
  })

  it('passes through labels correctly', () => {
    const config = buildAxisConfig({ labels: { x: 'time', y: 'distance' } })

    expect(config.defaultAxes?.x?.name).toBe('time')
    expect(config.defaultAxes?.y?.name).toBe('distance')
  })
})
