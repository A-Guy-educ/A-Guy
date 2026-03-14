import { describe, expect, it } from 'vitest'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'

// Import the utilities we're testing - these will fail until implemented
import {
  calculateAutoViewport,
  validateViewportRange,
  checkGraphVisibility,
  resolveViewport,
} from '@/infra/utils/graphics/viewport-utils'

describe('viewport-utils', () => {
  // FR-001: Automatic Range Calculation
  describe('calculateAutoViewport', () => {
    it('returns default range when no elements exist', () => {
      const emptySpec: AxisSpecV1 = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
        },
        elements: {
          points: [],
          graphs: [],
        },
      }

      const result = calculateAutoViewport(emptySpec)
      expect(result.xMin).toBe(-10)
      expect(result.xMax).toBe(10)
      expect(result.yMin).toBe(-10)
      expect(result.yMax).toBe(10)
    })

    it('includes all points with padding', () => {
      const specWithPoints: AxisSpecV1 = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
        },
        elements: {
          points: [
            { x: 2, y: 3, type: 'point' },
            { x: -5, y: 7, type: 'point' },
          ],
          graphs: [],
        },
      }

      const result = calculateAutoViewport(specWithPoints)
      // Should contain all points with some padding
      expect(result.xMin).toBeLessThanOrEqual(-5)
      expect(result.xMax).toBeGreaterThanOrEqual(2)
      expect(result.yMin).toBeLessThanOrEqual(3)
      expect(result.yMax).toBeGreaterThanOrEqual(7)
    })

    it('includes graph function range', () => {
      const specWithGraph: AxisSpecV1 = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
        },
        elements: {
          points: [],
          graphs: [
            {
              id: 'g1',
              fn: 'x^2',
              style: 'solid',
              thickness: 2,
            },
          ],
        },
      }

      const result = calculateAutoViewport(specWithGraph)
      // x^2 ranges from 0 to 100 in x:[-10,10], so Y should include this range
      expect(result.yMin).toBeLessThanOrEqual(0)
      expect(result.yMax).toBeGreaterThanOrEqual(100)
    })
  })

  // FR-004: Min-Max Validation
  describe('validateViewportRange', () => {
    it('returns valid for correct range', () => {
      const result = validateViewportRange({
        xMin: -5,
        xMax: 5,
        yMin: -10,
        yMax: 10,
      })

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns error when xMin >= xMax', () => {
      const result = validateViewportRange({
        xMin: 10,
        xMax: 5,
        yMin: -10,
        yMax: 10,
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('X-min must be less than X-max')
    })

    it('returns error when yMin >= yMax', () => {
      const result = validateViewportRange({
        xMin: -5,
        xMax: 5,
        yMin: 10,
        yMax: -10,
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Y-min must be less than Y-max')
    })

    it('returns error for non-finite values (NaN)', () => {
      const result = validateViewportRange({
        xMin: NaN,
        xMax: 5,
        yMin: -10,
        yMax: 10,
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('X-min must be a valid number')
    })

    it('returns error for Infinity', () => {
      const result = validateViewportRange({
        xMin: -Infinity,
        xMax: 5,
        yMin: -10,
        yMax: 10,
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('X-min must be a valid number')
    })

    it('returns multiple errors when both x and y are invalid', () => {
      const result = validateViewportRange({
        xMin: 10,
        xMax: 5,
        yMin: 10,
        yMax: -10,
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)
      expect(result.errors).toContain('X-min must be less than X-max')
      expect(result.errors).toContain('Y-min must be less than Y-max')
    })
  })

  // FR-006: Empty Grid Warning
  describe('checkGraphVisibility', () => {
    it('returns visible when graph is within viewport', () => {
      const spec: AxisSpecV1 = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
        },
        elements: {
          points: [],
          graphs: [
            {
              id: 'g1',
              fn: 'x^2',
              style: 'solid',
              thickness: 2,
            },
          ],
        },
      }

      const viewport = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 }
      const result = checkGraphVisibility(spec, viewport)

      expect(result.visible).toBe(true)
      expect(result.warning).toBeNull()
    })

    it('returns not visible when graph y-values are outside viewport', () => {
      const spec: AxisSpecV1 = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
        },
        elements: {
          points: [],
          graphs: [
            {
              id: 'g1',
              fn: 'x^2',
              style: 'solid',
              thickness: 2,
            },
          ],
        },
      }

      // Viewport with y range above where x^2 is (x^2 maxes at 100 in [-10,10] range)
      // Using yMin=101 ensures x^2 values (0-100) are all below viewport
      const viewport = { xMin: -10, xMax: 10, yMin: 101, yMax: 200 }
      const result = checkGraphVisibility(spec, viewport)

      expect(result.visible).toBe(false)
      expect(result.warning).toContain('Warning')
      expect(result.warning).toContain('No graph content is visible')
    })

    it('returns visible when at least one point is in viewport', () => {
      const spec: AxisSpecV1 = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
        },
        elements: {
          points: [
            { x: 2, y: 3, type: 'point' }, // Inside viewport
            { x: 100, y: 100, type: 'point' }, // Outside viewport
          ],
          graphs: [],
        },
      }

      const viewport = { xMin: 0, xMax: 5, yMin: 0, yMax: 5 }
      const result = checkGraphVisibility(spec, viewport)

      expect(result.visible).toBe(true)
      expect(result.warning).toBeNull()
    })

    it('returns not visible when all points are outside viewport', () => {
      const spec: AxisSpecV1 = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
        },
        elements: {
          points: [
            { x: 50, y: 60, type: 'point' }, // Way outside viewport
          ],
          graphs: [],
        },
      }

      const viewport = { xMin: 0, xMax: 5, yMin: 0, yMax: 5 }
      const result = checkGraphVisibility(spec, viewport)

      expect(result.visible).toBe(false)
      expect(result.warning).toContain('Warning')
    })
  })

  // FR-002: Manual Override + FR-008: Schema Extension
  describe('resolveViewport', () => {
    it('returns manual viewport when viewportMode is manual with complete viewport', () => {
      const spec: AxisSpecV1 = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
        },
        viewportMode: 'manual',
        viewport: { xMin: -5, xMax: 5, yMin: -20, yMax: 20 },
        elements: {
          points: [],
          graphs: [],
        },
      }

      const result = resolveViewport(spec)

      expect(result.xMin).toBe(-5)
      expect(result.xMax).toBe(5)
      expect(result.yMin).toBe(-20)
      expect(result.yMax).toBe(20)
    })

    it('returns auto-calculated viewport when viewportMode is auto', () => {
      const spec: AxisSpecV1 = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
        },
        viewportMode: 'auto',
        viewport: { xMin: -5, xMax: 5, yMin: -20, yMax: 20 },
        elements: {
          points: [{ x: 2, y: 3, type: 'point' }],
          graphs: [],
        },
      }

      const result = resolveViewport(spec)

      // Should NOT return manual values, should calculate from elements
      expect(result.xMin).not.toBe(-5)
      expect(result.xMax).not.toBe(5)
    })

    it('returns auto-calculated viewport when viewportMode is undefined (backward compat)', () => {
      const spec: AxisSpecV1 = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
        },
        // No viewportMode field - backward compatibility
        viewport: { xMin: -5, xMax: 5, yMin: -20, yMax: 20 },
        elements: {
          points: [{ x: 2, y: 3, type: 'point' }],
          graphs: [],
        },
      }

      const result = resolveViewport(spec)

      // Should default to auto mode
      expect(result.xMin).not.toBe(-5)
    })
  })
})
