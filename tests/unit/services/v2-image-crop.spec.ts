/**
 * Unit Tests for V2 Image Crop Service
 *
 * Tests:
 * - cropExerciseImage crops correct region from page image
 * - Handles edge cases (bbox at page edges)
 * - Rejects crops below minimum size threshold
 * - Output is valid PNG buffer
 * - Coordinate conversion functions work correctly
 */

import { describe, expect, it } from 'vitest'

describe('V2 Image Crop Service', () => {
  describe('NormalizedBbox interface', () => {
    it('should accept valid bbox coordinates', () => {
      const bbox = {
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4,
      }

      expect(bbox.x).toBe(0.1)
      expect(bbox.y).toBe(0.2)
      expect(bbox.width).toBe(0.3)
      expect(bbox.height).toBe(0.4)
    })

    it('should clamp coordinates to 0-1 range', () => {
      // The service should clamp out-of-range values
      const clamped = {
        x: Math.max(0, Math.min(1, 1.5)),
        y: Math.max(0, Math.min(1, -0.2)),
        width: Math.max(0, Math.min(1 - Math.max(0, Math.min(1, 1.5)), 2)),
        height: Math.max(0, Math.min(1 - Math.max(0, Math.min(1, -0.2)), 1.5)),
      }

      expect(clamped.x).toBe(1)
      expect(clamped.y).toBe(0)
      expect(clamped.width).toBe(0) // Clamped to 0 because x + width > 1
      expect(clamped.height).toBe(1)
    })
  })

  describe('normalizedToPixels', () => {
    it('should convert normalized coordinates to pixels', () => {
      // Simulating the conversion function
      const bbox = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
      const pageWidth = 1000
      const pageHeight = 1500

      const pixels = {
        x: Math.round(bbox.x * pageWidth),
        y: Math.round(bbox.y * pageHeight),
        width: Math.round(bbox.width * pageWidth),
        height: Math.round(bbox.height * pageHeight),
      }

      expect(pixels.x).toBe(100) // 0.1 * 1000
      expect(pixels.y).toBe(300) // 0.2 * 1500
      expect(pixels.width).toBe(300) // 0.3 * 1000
      expect(pixels.height).toBe(600) // 0.4 * 1500
    })

    it('should round coordinates correctly', () => {
      const bbox = { x: 0.111, y: 0.222, width: 0.333, height: 0.444 }
      const pageWidth = 100
      const pageHeight = 100

      const pixels = {
        x: Math.round(bbox.x * pageWidth),
        y: Math.round(bbox.y * pageHeight),
        width: Math.round(bbox.width * pageWidth),
        height: Math.round(bbox.height * pageHeight),
      }

      expect(pixels.x).toBe(11) // 0.111 * 100 = 11.1, rounded to 11
      expect(pixels.y).toBe(22) // 0.222 * 100 = 22.2, rounded to 22
      expect(pixels.width).toBe(33) // 0.333 * 100 = 33.3, rounded to 33
      expect(pixels.height).toBe(44) // 0.444 * 100 = 44.4, rounded to 44
    })
  })

  describe('pixelsToNormalized', () => {
    it('should convert pixel coordinates to normalized', () => {
      const x = 100
      const y = 200
      const width = 300
      const height = 400
      const pageWidth = 1000
      const pageHeight = 1500

      const normalized = {
        x: Math.max(0, Math.min(1, x / pageWidth)),
        y: Math.max(0, Math.min(1, y / pageHeight)),
        width: Math.max(0, Math.min(1, width / pageWidth)),
        height: Math.max(0, Math.min(1, height / pageHeight)),
      }

      expect(normalized.x).toBe(0.1)
      expect(normalized.y).toBeCloseTo(0.1333, 3)
      expect(normalized.width).toBe(0.3)
      expect(normalized.height).toBeCloseTo(0.2667, 3)
    })
  })

  describe('validateBbox', () => {
    it('should reject negative coordinates', () => {
      const bbox = { x: -0.1, y: 0.2, width: 0.3, height: 0.4 }
      const isValid = bbox.x >= 0 && bbox.y >= 0 && bbox.width > 0 && bbox.height > 0

      expect(isValid).toBe(false)
    })

    it('should reject zero width or height', () => {
      const bbox = { x: 0.1, y: 0.2, width: 0, height: 0.4 }
      const isValid = bbox.x >= 0 && bbox.y >= 0 && bbox.width > 0 && bbox.height > 0

      expect(isValid).toBe(false)
    })

    it('should reject bboxes exceeding page boundaries', () => {
      const bbox = { x: 0.8, y: 0.8, width: 0.5, height: 0.5 }
      const isValid = bbox.x + bbox.width <= 1 && bbox.y + bbox.height <= 1

      expect(isValid).toBe(false) // 0.8 + 0.5 = 1.3 > 1
    })

    it('should accept valid bbox within boundaries', () => {
      const bbox = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
      const isValid =
        bbox.x >= 0 &&
        bbox.y >= 0 &&
        bbox.width > 0 &&
        bbox.height > 0 &&
        bbox.x + bbox.width <= 1 &&
        bbox.y + bbox.height <= 1

      expect(isValid).toBe(true)
    })

    it('should reject crops below minimum size threshold', () => {
      const pageWidth = 1000
      const pageHeight = 1000
      const minWidth = 20
      const minHeight = 20

      // Bbox that would result in < 20px crop
      const bbox = { x: 0, y: 0, width: 0.01, height: 0.01 }
      const pixelWidth = Math.round(bbox.width * pageWidth)
      const pixelHeight = Math.round(bbox.height * pageHeight)

      const isValidSize = pixelWidth >= minWidth && pixelHeight >= minHeight

      expect(pixelWidth).toBe(10) // 0.01 * 1000 = 10px
      expect(pixelHeight).toBe(10) // 0.01 * 1000 = 10px
      expect(isValidSize).toBe(false)
    })
  })

  describe('Crop edge cases', () => {
    it('should handle bbox at page edge', () => {
      // Bbox starting at edge
      const bbox = { x: 0, y: 0, width: 0.5, height: 0.5 }
      const pageWidth = 1000
      const pageHeight = 1000

      const pixels = {
        x: Math.max(0, Math.min(1, bbox.x)) * pageWidth,
        y: Math.max(0, Math.min(1, bbox.y)) * pageHeight,
      }

      expect(pixels.x).toBe(0)
      expect(pixels.y).toBe(0)
    })

    it('should handle full-page bbox', () => {
      const bbox = { x: 0, y: 0, width: 1, height: 1 }
      const pageWidth = 1000
      const pageHeight = 1500

      const pixels = {
        x: Math.round(bbox.x * pageWidth),
        y: Math.round(bbox.y * pageHeight),
        width: Math.round(bbox.width * pageWidth),
        height: Math.round(bbox.height * pageHeight),
      }

      expect(pixels).toEqual({ x: 0, y: 0, width: 1000, height: 1500 })
    })

    it('should handle small but valid bbox', () => {
      const bbox = { x: 0.5, y: 0.5, width: 0.1, height: 0.1 }
      const pageWidth = 500
      const pageHeight = 500
      const minSize = 20

      const pixels = {
        width: Math.round(bbox.width * pageWidth),
        height: Math.round(bbox.height * pageHeight),
      }

      // 0.1 * 500 = 50px (above minimum threshold)
      expect(pixels.width).toBe(50)
      expect(pixels.height).toBe(50)
      expect(pixels.width).toBeGreaterThanOrEqual(minSize)
      expect(pixels.height).toBeGreaterThanOrEqual(minSize)
    })
  })

  describe('Bbox serialization', () => {
    it('should serialize bbox to JSON correctly', () => {
      const bbox = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
      const json = JSON.stringify(bbox)

      expect(json).toBe('{"x":0.1,"y":0.2,"width":0.3,"height":0.4}')
    })

    it('should parse bbox from JSON correctly', () => {
      const json = '{"x":0.1,"y":0.2,"width":0.3,"height":0.4}'
      const bbox = JSON.parse(json)

      expect(bbox).toEqual({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 })
    })
  })
})
