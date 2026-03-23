import type { CollectionSlug, Field } from 'payload'

/**
 * Shared field for the Clone-and-Translate system.
 *
 * Points back to the source document this entity was translated from.
 * Each collection passes its own slug so the relationship is self-referential.
 */
export function translatedFromField(relationTo: CollectionSlug): Field {
  return {
    name: 'translatedFrom',
    type: 'relationship',
    relationTo,
    index: true,
    admin: {
      position: 'sidebar',
      description: 'Source document this was translated from',
      readOnly: true,
    },
  }
}
