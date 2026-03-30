import type { CollectionConfig } from 'payload'

import { tenantField } from '@/server/payload/fields/tenant'
import { Content } from '../blocks/Content/config'
import { GeometryBlock } from '../blocks/GeometryBlock/config'
import { GraphBlock } from '../blocks/GraphBlock/config'
import { HtmlBlock } from '../blocks/HtmlBlock/config'
import { MediaBlock } from '../blocks/MediaBlock/config'
import { TableBlock } from '../blocks/TableBlock/config'
import { adminOnly } from '../access/adminOnly'
import { publishedAndActive } from '../access/publishedAndActive'
import { pageDefaultSpacingField } from '../fields/blockSpacing'
import { createdByField } from '../fields/createdBy'
import { formatSlug } from '../fields/formatSlug'
import { addBlockToLesson, removeBlockFromLesson } from '../hooks/lessons/syncLessonBlocks'

export const ContentPages: CollectionConfig = {
  slug: 'content-pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'isActive', 'updatedAt'],
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: publishedAndActive,
    update: adminOnly,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.slug) {
          data.slug = data.slug.trim()
        }
        if (data?.title && !data?.slug) {
          const timestamp =
            typeof data.createdAt === 'string'
              ? data.createdAt.replace(/[^0-9]/g, '').slice(-6)
              : Date.now().toString().slice(-6)
          data.slug = `${formatSlug(data.title)}-${timestamp}`
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        if (req.context?._skipBlockSync) return doc

        const newLessonId =
          typeof doc.lesson === 'string' ? doc.lesson : (doc.lesson as { id?: string })?.id
        const oldLessonId = previousDoc
          ? typeof previousDoc.lesson === 'string'
            ? previousDoc.lesson
            : (previousDoc.lesson as { id?: string })?.id
          : null

        // Lesson changed — remove from old, add to new
        if (oldLessonId && oldLessonId !== newLessonId) {
          await removeBlockFromLesson({
            payload: req.payload,
            req,
            lessonId: oldLessonId,
            refId: doc.id,
            blockType: 'contentPageRef',
          })
        }

        if (newLessonId) {
          await addBlockToLesson({
            payload: req.payload,
            req,
            lessonId: newLessonId,
            refId: doc.id,
            blockType: 'contentPageRef',
          })
        }

        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (req.context?._skipBlockSync) return doc

        const lessonId =
          typeof doc.lesson === 'string' ? doc.lesson : (doc.lesson as { id?: string })?.id
        if (lessonId) {
          await removeBlockFromLesson({
            payload: req.payload,
            req,
            lessonId,
            refId: doc.id,
            blockType: 'contentPageRef',
          })
        }

        return doc
      },
    ],
  },
  fields: [
    tenantField,
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons',
      required: true,
      index: true,
      admin: {
        description: 'The lesson this content page belongs to',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Content page title',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: false,
      index: true,
      unique: true,
      admin: {
        position: 'sidebar',
        description: 'URL-friendly identifier (auto-generated from title if empty)',
      },
    },
    {
      name: 'body',
      type: 'blocks',
      blocks: [Content, HtmlBlock, MediaBlock, TableBlock, GeometryBlock, GraphBlock],
      required: true,
      admin: {
        description:
          'Page content. Supports rich text, HTML/SVG, media, tables, geometry, and graphs.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        description: 'Publication status',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: {
        description: 'Whether this content page is currently active',
      },
    },
    pageDefaultSpacingField,
    createdByField,
  ],
}
