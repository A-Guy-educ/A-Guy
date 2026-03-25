import {
  ContentSlotItemDataSchema,
  ContentSlotItemSchema,
  ContentSlotSchema,
  RichContentSchema,
} from '@/server/payload/collections/Exercises/schemas'
import {
  contentSlotItemToText,
  contentSlotToInlineRichText,
  contentSlotToText,
  inlineRichTextToSlot,
  isContentSlot,
  isInlineRichText,
  isRichContent,
  richContentToText,
  type ContentSlot,
  type InlineRichText,
} from '@/server/payload/collections/Exercises/types'
import { deepCloneContentSlot } from '@/ui/admin/ExerciseContentEditor/utils'
import { describe, expect, it } from 'vitest'

describe('ContentSlot Schema', () => {
  describe('ContentSlotItemDataSchema', () => {
    it('should validate rich_text item', () => {
      const result = ContentSlotItemDataSchema.safeParse({
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Hello world',
        mediaIds: [],
      })
      expect(result.success).toBe(true)
    })

    it('should validate latex item', () => {
      const result = ContentSlotItemDataSchema.safeParse({
        type: 'latex',
        latex: 'E = mc^2',
        renderMode: 'block',
      })
      expect(result.success).toBe(true)
    })

    it('should validate svg item', () => {
      const result = ContentSlotItemDataSchema.safeParse({
        type: 'svg',
        value: '<svg></svg>',
        altText: 'Test SVG',
      })
      expect(result.success).toBe(true)
    })

    it('should validate media item', () => {
      const result = ContentSlotItemDataSchema.safeParse({
        type: 'media',
        mediaId: 'media-123',
      })
      expect(result.success).toBe(true)
    })

    it('should validate axis_display item', () => {
      const result = ContentSlotItemDataSchema.safeParse({
        type: 'axis_display',
        axis: {
          kind: 'cartesian',
          units: 1,
          grid: { enabled: true },
          axes: {
            showNumbers: true,
            showLabels: true,
            labels: { x: 'x', y: 'y' },
            origin: { x: 0, y: 0 },
            ticks: 1,
          },
          viewportMode: 'auto',
          viewport: {},
          elements: { graphs: [], points: [], segments: [], vectors: [], labels: [], paints: [] },
          interactionSpec: { enabled: false, toolsAllowed: [] },
        },
        displaySize: 'medium',
      })
      expect(result.success).toBe(true)
    })

    it('should validate geometry_display item', () => {
      const result = ContentSlotItemDataSchema.safeParse({
        type: 'geometry_display',
        geometry: {
          kind: 'euclidean',
          canvas: { width: 400, height: 400, backgroundColor: '#ffffff' },
          elements: {
            points: [],
            lines: [],
            circles: [],
            polygons: [],
            angles: [],
            arcs: [],
            texts: [],
          },
          interactionSpec: { enabled: false, toolsAllowed: [] },
        },
      })
      expect(result.success).toBe(true)
    })

    it('should validate html item', () => {
      const result = ContentSlotItemDataSchema.safeParse({
        type: 'html',
        html: '<p>Test</p>',
      })
      expect(result.success).toBe(true)
    })

    it('should reject unknown type', () => {
      const result = ContentSlotItemDataSchema.safeParse({
        type: 'unknown_type',
        value: 'test',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ContentSlotItemSchema', () => {
    it('should validate item with id and data', () => {
      const result = ContentSlotItemSchema.safeParse({
        id: 'item-123',
        data: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Test content',
          mediaIds: [],
        },
      })
      expect(result.success).toBe(true)
    })

    it('should reject item without id', () => {
      const result = ContentSlotItemSchema.safeParse({
        data: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Test content',
          mediaIds: [],
        },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ContentSlotSchema', () => {
    it('should validate valid ContentSlot with items', () => {
      const result = ContentSlotSchema.safeParse({
        version: 2,
        items: [
          {
            id: 'item-1',
            data: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'First item',
              mediaIds: [],
            },
          },
          {
            id: 'item-2',
            data: {
              type: 'latex',
              latex: 'x^2 + y^2 = r^2',
            },
          },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('should validate empty items array', () => {
      const result = ContentSlotSchema.safeParse({
        version: 2,
        items: [],
      })
      expect(result.success).toBe(true)
    })

    it('should reject version other than 2', () => {
      const result = ContentSlotSchema.safeParse({
        version: 1,
        items: [],
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing version', () => {
      const result = ContentSlotSchema.safeParse({
        items: [],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('RichContentSchema', () => {
    it('should validate InlineRichText (v1)', () => {
      const result = RichContentSchema.safeParse({
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Hello',
        mediaIds: [],
      })
      expect(result.success).toBe(true)
    })

    it('should validate ContentSlot (v2)', () => {
      const result = RichContentSchema.safeParse({
        version: 2,
        items: [
          {
            id: 'item-1',
            data: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'Content',
              mediaIds: [],
            },
          },
        ],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Type Guards', () => {
    it('isContentSlot should return true for ContentSlot', () => {
      const slot: ContentSlot = {
        version: 2,
        items: [],
      }
      expect(isContentSlot(slot)).toBe(true)
    })

    it('isContentSlot should return false for InlineRichText', () => {
      const irt: InlineRichText = {
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'test',
        mediaIds: [],
      }
      expect(isContentSlot(irt)).toBe(false)
    })

    it('isContentSlot should return false for null/undefined', () => {
      expect(isContentSlot(null)).toBe(false)
      expect(isContentSlot(undefined)).toBe(false)
      expect(isContentSlot({})).toBe(false)
    })

    it('isInlineRichText should return true for InlineRichText', () => {
      const irt: InlineRichText = {
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'test',
        mediaIds: [],
      }
      expect(isInlineRichText(irt)).toBe(true)
    })

    it('isInlineRichText should return false for ContentSlot', () => {
      const slot: ContentSlot = {
        version: 2,
        items: [],
      }
      expect(isInlineRichText(slot)).toBe(false)
    })

    it('isRichContent should return true for both formats', () => {
      const irt: InlineRichText = {
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'test',
        mediaIds: [],
      }
      const slot: ContentSlot = {
        version: 2,
        items: [],
      }
      expect(isRichContent(irt)).toBe(true)
      expect(isRichContent(slot)).toBe(true)
    })
  })

  describe('Conversion Functions', () => {
    describe('inlineRichTextToSlot', () => {
      it('should convert InlineRichText to ContentSlot', () => {
        const irt: InlineRichText = {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Converted content',
          mediaIds: ['media-1', 'media-2'],
        }

        const slot = inlineRichTextToSlot(irt)

        expect(slot.version).toBe(2)
        expect(slot.items).toHaveLength(1)
        const item = slot.items[0]
        expect(item.data.type).toBe('rich_text')
        // Type guard to narrow the type
        if (item.data.type === 'rich_text') {
          expect(item.data.value).toBe('Converted content')
          expect(item.data.mediaIds).toEqual(['media-1', 'media-2'])
        }
        expect(item.id).toBeDefined()
      })

      it('should generate unique IDs for each conversion', () => {
        const irt: InlineRichText = {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'test',
          mediaIds: [],
        }

        const slot1 = inlineRichTextToSlot(irt)
        const slot2 = inlineRichTextToSlot(irt)

        expect(slot1.items[0].id).not.toBe(slot2.items[0].id)
      })
    })

    describe('contentSlotToInlineRichText', () => {
      it('should convert ContentSlot with single rich_text to InlineRichText', () => {
        const slot: ContentSlot = {
          version: 2,
          items: [
            {
              id: 'item-1',
              data: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'Original content',
                mediaIds: ['media-1'],
              },
            },
          ],
        }

        const result = contentSlotToInlineRichText(slot)

        expect(result).not.toBeNull()
        expect(result?.type).toBe('rich_text')
        if (result && result.type === 'rich_text') {
          expect(result.value).toBe('Original content')
          expect(result.mediaIds).toEqual(['media-1'])
        }
      })

      it('should return null for slot with multiple items', () => {
        const slot: ContentSlot = {
          version: 2,
          items: [
            {
              id: 'item-1',
              data: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'First',
                mediaIds: [],
              },
            },
            {
              id: 'item-2',
              data: {
                type: 'latex',
                latex: 'x^2',
              },
            },
          ],
        }

        const result = contentSlotToInlineRichText(slot)

        expect(result).toBeNull()
      })

      it('should return null for slot with non-rich_text item', () => {
        const slot: ContentSlot = {
          version: 2,
          items: [
            {
              id: 'item-1',
              data: {
                type: 'latex',
                latex: 'x^2',
              },
            },
          ],
        }

        const result = contentSlotToInlineRichText(slot)

        expect(result).toBeNull()
      })

      it('should return null for empty slot', () => {
        const slot: ContentSlot = {
          version: 2,
          items: [],
        }

        const result = contentSlotToInlineRichText(slot)

        expect(result).toBeNull()
      })
    })

    describe('Round-trip conversion', () => {
      it('should round-trip InlineRichText through slot conversion', () => {
        const original: InlineRichText = {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Round-trip test',
          mediaIds: ['m1', 'm2', 'm3'],
        }

        const slot = inlineRichTextToSlot(original)
        const result = contentSlotToInlineRichText(slot)

        expect(result).not.toBeNull()
        if (result && result.type === 'rich_text') {
          expect(result.value).toBe(original.value)
          expect(result.mediaIds).toEqual(original.mediaIds)
        }
      })
    })
  })

  describe('deepCloneContentSlot', () => {
    it('should clone ContentSlot with new item IDs', () => {
      const slot: ContentSlot = {
        version: 2,
        items: [
          {
            id: 'item-1',
            data: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'Content A',
              mediaIds: [],
            },
          },
          {
            id: 'item-2',
            data: {
              type: 'latex',
              latex: 'x^2',
            },
          },
        ],
      }

      const cloned = deepCloneContentSlot(slot)

      expect(cloned.version).toBe(2)
      expect(cloned.items).toHaveLength(2)
      // IDs should be different
      expect(cloned.items[0].id).not.toBe('item-1')
      expect(cloned.items[1].id).not.toBe('item-2')
      // But values should be preserved
      if (cloned.items[0].data.type === 'rich_text') {
        expect(cloned.items[0].data.value).toBe('Content A')
      }
      if (cloned.items[1].data.type === 'latex') {
        expect(cloned.items[1].data.latex).toBe('x^2')
      }
    })

    it('should generate unique IDs for each item', () => {
      const slot: ContentSlot = {
        version: 2,
        items: [
          {
            id: 'item-1',
            data: { type: 'rich_text', format: 'md-math-v1', value: 'A', mediaIds: [] },
          },
          {
            id: 'item-2',
            data: { type: 'rich_text', format: 'md-math-v1', value: 'B', mediaIds: [] },
          },
          {
            id: 'item-3',
            data: { type: 'rich_text', format: 'md-math-v1', value: 'C', mediaIds: [] },
          },
        ],
      }

      const cloned = deepCloneContentSlot(slot)

      const ids = cloned.items.map((i: { id: string }) => i.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(3) // All IDs should be unique
    })

    it('should deep clone nested data objects', () => {
      const slot: ContentSlot = {
        version: 2,
        items: [
          {
            id: 'item-1',
            data: {
              type: 'axis_display',
              axis: {
                kind: 'cartesian',
                units: 1,
                grid: { enabled: true },
                axes: {
                  showNumbers: true,
                  showLabels: true,
                  labels: { x: 'X', y: 'Y' },
                  origin: { x: 0, y: 0 },
                  ticks: 1,
                },
                viewportMode: 'auto',
                viewport: {},
                elements: { graphs: [], points: [] },
                interactionSpec: { enabled: false, toolsAllowed: [] },
              },
              displaySize: 'medium',
            },
          },
        ],
      }

      const cloned = deepCloneContentSlot(slot)

      // Modify the cloned axis
      if (cloned.items[0].data.type === 'axis_display') {
        cloned.items[0].data.axis.axes.labels.x = 'Modified'

        // Original should be unchanged
        const original = slot.items[0].data
        if (original.type === 'axis_display') {
          expect(original.axis.axes.labels.x).toBe('X')
        }
      }
    })
  })

  describe('AI Chat Serialization', () => {
    describe('contentSlotItemToText', () => {
      it('should serialize rich_text item', () => {
        const item = {
          id: 'item-1',
          data: {
            type: 'rich_text' as const,
            format: 'md-math-v1' as const,
            value: 'Hello world',
            mediaIds: [],
          },
        }
        expect(contentSlotItemToText(item)).toBe('Hello world')
      })

      it('should serialize latex item with delimiters', () => {
        const item = {
          id: 'item-1',
          data: { type: 'latex' as const, latex: 'E = mc^2' },
        }
        expect(contentSlotItemToText(item)).toBe('$$E = mc^2$$')
      })

      it('should serialize svg item with alt text', () => {
        const item = {
          id: 'item-1',
          data: { type: 'svg' as const, value: '<svg>...</svg>', altText: 'A triangle' },
        }
        expect(contentSlotItemToText(item)).toBe('[SVG: A triangle]')
      })

      it('should serialize svg item without alt text', () => {
        const item = {
          id: 'item-1',
          data: { type: 'svg' as const, value: '<svg>...</svg>' },
        }
        expect(contentSlotItemToText(item)).toBe('[SVG]')
      })

      it('should serialize media item', () => {
        const item = {
          id: 'item-1',
          data: { type: 'media' as const, mediaId: 'media-123' },
        }
        expect(contentSlotItemToText(item)).toBe('[Media]')
      })

      it('should serialize axis_display item', () => {
        const item = {
          id: 'item-1',
          data: {
            type: 'axis_display' as const,
            axis: {
              kind: 'cartesian' as const,
              units: 1,
              grid: { enabled: true },
              axes: {
                showNumbers: true,
                showLabels: true,
                labels: { x: 'x', y: 'y' },
                origin: { x: 0, y: 0 },
                ticks: 1,
              },
              viewportMode: 'auto' as const,
              viewport: {},
              elements: { graphs: [], points: [] },
              interactionSpec: { enabled: false, toolsAllowed: [] },
            },
          },
        }
        expect(contentSlotItemToText(item)).toBe('[Graph: coordinate plane]')
      })

      it('should serialize geometry_display item', () => {
        const item = {
          id: 'item-1',
          data: {
            type: 'geometry_display' as const,
            geometry: {
              kind: 'euclidean' as const,
              canvas: { width: 400, height: 400, backgroundColor: '#ffffff' },
              elements: {
                points: [],
                lines: [],
                circles: [],
                polygons: [],
                angles: [],
                arcs: [],
                texts: [],
              },
              interactionSpec: { enabled: false, toolsAllowed: [] },
            },
          },
        }
        expect(contentSlotItemToText(item)).toBe('[Geometry: construction]')
      })

      it('should serialize html item by stripping tags', () => {
        const item = {
          id: 'item-1',
          data: { type: 'html' as const, html: '<p>Hello <strong>world</strong></p>' },
        }
        expect(contentSlotItemToText(item)).toBe('Hello world')
      })
    })

    describe('contentSlotToText', () => {
      it('should serialize ContentSlot with multiple items', () => {
        const slot: ContentSlot = {
          version: 2,
          items: [
            {
              id: 'item-1',
              data: { type: 'rich_text', format: 'md-math-v1', value: 'First', mediaIds: [] },
            },
            { id: 'item-2', data: { type: 'latex', latex: 'x^2' } },
            {
              id: 'item-3',
              data: { type: 'rich_text', format: 'md-math-v1', value: 'Third', mediaIds: [] },
            },
          ],
        }
        expect(contentSlotToText(slot)).toBe('First\n$$x^2$$\nThird')
      })
    })

    describe('richContentToText', () => {
      it('should serialize InlineRichText (v1)', () => {
        const content: InlineRichText = {
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'v1 content',
          mediaIds: [],
        }
        expect(richContentToText(content)).toBe('v1 content')
      })

      it('should serialize ContentSlot (v2)', () => {
        const content: ContentSlot = {
          version: 2,
          items: [
            {
              id: 'item-1',
              data: { type: 'rich_text', format: 'md-math-v1', value: 'v2 content', mediaIds: [] },
            },
          ],
        }
        expect(richContentToText(content)).toBe('v2 content')
      })
    })
  })
})
