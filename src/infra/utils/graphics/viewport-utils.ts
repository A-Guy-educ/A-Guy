/**
 * @fileType utility
 * @domain graphics
 * @pattern viewport-calculation
 * @ai-summary Viewport utility functions for auto-calculating, validating, and resolving graph display ranges
 */

import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'

/**
 * Viewport bounds
 */
export interface ViewportBounds {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

/**
 * Validation result
 */
export interface ViewportValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Visibility check result
 */
export interface GraphVisibilityResult {
  visible: boolean
  warning: string | null
}

/**
 * Safely evaluate a math expression string at a given x value
 * Returns null if evaluation fails
 */
function evaluateMathExpression(fn: string, x: number): number | null {
  try {
    // Replace ^ with ** for JavaScript exponentiation
    const jsFn = fn.replace(/\^/g, '**')
    const fnWithX = new Function('x', `return ${jsFn}`)
    const result = fnWithX(x)
    if (!Number.isFinite(result)) return null
    return result
  } catch {
    return null
  }
}

/**
 * Calculate the auto viewport based on graph elements
 * Analyzes points, graphs, asymptotes, and line segments to determine a bounding box
 */
export function calculateAutoViewport(spec: AxisSpecV1): ViewportBounds {
  const DEFAULT_BOUNDS: ViewportBounds = {
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10,
  }

  // Start with default bounds
  let xMin = DEFAULT_BOUNDS.xMin
  let xMax = DEFAULT_BOUNDS.xMax
  let yMin = DEFAULT_BOUNDS.yMin
  let yMax = DEFAULT_BOUNDS.yMax

  let hasContent = false

  // Analyze points
  for (const point of spec.elements.points) {
    hasContent = true
    xMin = Math.min(xMin, point.x)
    xMax = Math.max(xMax, point.x)
    yMin = Math.min(yMin, point.y)
    yMax = Math.max(yMax, point.y)
  }

  // Analyze graphs (sample at multiple x values)
  const sampleCount = 20
  const sampleRange = 10 // Sample from -10 to 10

  for (const graph of spec.elements.graphs) {
    hasContent = true
    for (let i = 0; i <= sampleCount; i++) {
      const x = -sampleRange + (i / sampleCount) * (sampleRange * 2)
      const y = evaluateMathExpression(graph.fn, x)
      if (y !== null) {
        xMin = Math.min(xMin, x)
        xMax = Math.max(xMax, x)
        yMin = Math.min(yMin, y)
        yMax = Math.max(yMax, y)
      }
    }
  }

  // Analyze vertical asymptotes
  for (const xVal of spec.elements.asymptotesVertical || []) {
    hasContent = true
    xMin = Math.min(xMin, xVal)
    xMax = Math.max(xMax, xVal)
  }

  // Analyze horizontal asymptotes
  for (const yVal of spec.elements.asymptotesHorizontal || []) {
    hasContent = true
    yMin = Math.min(yMin, yVal)
    yMax = Math.max(yMax, yVal)
  }

  // Analyze line segments between points
  for (const line of spec.elements.lineBetweenPoints || []) {
    hasContent = true
    xMin = Math.min(xMin, line.a.x, line.b.x)
    xMax = Math.max(xMax, line.a.x, line.b.x)
    yMin = Math.min(yMin, line.a.y, line.b.y)
    yMax = Math.max(yMax, line.a.y, line.b.y)
  }

  // If no content, return default bounds
  if (!hasContent) {
    return DEFAULT_BOUNDS
  }

  // Add 10% padding (minimum 1 unit)
  const xPadding = Math.max(1, (xMax - xMin) * 0.1)
  const yPadding = Math.max(1, (yMax - yMin) * 0.1)

  return {
    xMin: xMin - xPadding,
    xMax: xMax + xPadding,
    yMin: yMin - yPadding,
    yMax: yMax + yPadding,
  }
}

/**
 * Validate viewport range values
 */
export function validateViewportRange(viewport: ViewportBounds): ViewportValidationResult {
  const errors: string[] = []

  // Check all values are finite numbers
  if (!Number.isFinite(viewport.xMin)) {
    errors.push('X-min must be a valid number')
  }
  if (!Number.isFinite(viewport.xMax)) {
    errors.push('X-max must be a valid number')
  }
  if (!Number.isFinite(viewport.yMin)) {
    errors.push('Y-min must be a valid number')
  }
  if (!Number.isFinite(viewport.yMax)) {
    errors.push('Y-max must be a valid number')
  }

  // If there are numeric errors, don't check min/max
  if (errors.length > 0) {
    return { valid: false, errors }
  }

  // Check xMin < xMax
  if (viewport.xMin >= viewport.xMax) {
    errors.push('X-min must be less than X-max')
  }

  // Check yMin < yMax
  if (viewport.yMin >= viewport.yMax) {
    errors.push('Y-min must be less than Y-max')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Check if graph content is visible within the viewport
 */
export function checkGraphVisibility(
  spec: AxisSpecV1,
  viewport: ViewportBounds,
): GraphVisibilityResult {
  const sampleCount = 20

  // Check graphs
  for (const graph of spec.elements.graphs) {
    let hasVisiblePoint = false

    for (let i = 0; i <= sampleCount; i++) {
      const x = viewport.xMin + (i / sampleCount) * (viewport.xMax - viewport.xMin)
      const y = evaluateMathExpression(graph.fn, x)

      if (y !== null && y >= viewport.yMin && y <= viewport.yMax) {
        hasVisiblePoint = true
        break
      }
    }

    if (hasVisiblePoint) {
      return { visible: true, warning: null }
    }
  }

  // Check points
  for (const point of spec.elements.points) {
    if (
      point.x >= viewport.xMin &&
      point.x <= viewport.xMax &&
      point.y >= viewport.yMin &&
      point.y <= viewport.yMax
    ) {
      return { visible: true, warning: null }
    }
  }

  // Check line segments
  for (const line of spec.elements.lineBetweenPoints || []) {
    // Check if line segment intersects viewport
    const minX = Math.min(line.a.x, line.b.x)
    const maxX = Math.max(line.a.x, line.b.x)
    const minY = Math.min(line.a.y, line.b.y)
    const maxY = Math.max(line.a.y, line.b.y)

    if (
      !(
        maxX < viewport.xMin ||
        minX > viewport.xMax ||
        maxY < viewport.yMin ||
        minY > viewport.yMax
      )
    ) {
      return { visible: true, warning: null }
    }
  }

  // No content visible
  return {
    visible: false,
    warning: 'Warning: No graph content is visible in the configured range.',
  }
}

/**
 * Resolve the final viewport based on mode
 * Returns auto-calculated viewport for 'auto' mode, or manual values for 'manual' mode
 */
export function resolveViewport(spec: AxisSpecV1): ViewportBounds {
  // Check if manual mode is enabled and has complete viewport values
  const isManualMode = spec.viewportMode === 'manual'
  const hasCompleteViewport =
    spec.viewport?.xMin !== undefined &&
    spec.viewport?.xMax !== undefined &&
    spec.viewport?.yMin !== undefined &&
    spec.viewport?.yMax !== undefined

  if (isManualMode && hasCompleteViewport) {
    return {
      xMin: spec.viewport!.xMin!,
      xMax: spec.viewport!.xMax!,
      yMin: spec.viewport!.yMin!,
      yMax: spec.viewport!.yMax!,
    }
  }

  // Otherwise, calculate auto viewport
  return calculateAutoViewport(spec)
}
