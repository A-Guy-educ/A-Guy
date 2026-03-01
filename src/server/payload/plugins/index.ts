import { revalidateRedirects } from '@/server/payload/hooks/revalidateRedirects'
import { beforeSyncWithSearch } from '@/ui/web/search/beforeSync'
import { searchFields } from '@/ui/web/search/fieldOverrides'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { searchPlugin } from '@payloadcms/plugin-search'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { Plugin } from 'payload'

import { getServerSideURL } from '@/infra/utils/getURL'
import { Page } from '@/payload-types'

import { mcp as mcpPlugin } from './mcp'

// MCP plugin - conditionally enabled based on env var or default
// Order: env var 'false' → env var 'true' → default to true
// Note: ConfigEntry check can be added in the handler for runtime flexibility
const mcp = process.env.MCP_ENABLED === 'false' ? null : mcpPlugin

const generateTitle: GenerateTitle<Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | Payload Website Template` : 'Payload Website Template'
}

const generateURL: GenerateURL<Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

// Vercel Blob storage plugin - throws error if token is not available
// During type generation (PAYLOAD_GENERATE_TYPES=true), this is skipped
let vercelBlobPlugin: Plugin | null = null
if (process.env.PAYLOAD_GENERATE_TYPES !== 'true') {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN

  if (!blobToken) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN environment variable is required. ' +
        'Vercel Blob storage is mandatory for this application. ' +
        'Please set BLOB_READ_WRITE_TOKEN in your environment configuration.',
    )
  }

  vercelBlobPlugin = vercelBlobStorage({
    addRandomSuffix: true,
    clientUploads: false,
    // Use proxy mode - URLs are /api/media/file/... and static handler proxies to blob
    // This ensures PDF viewer works (same-origin URLs) and backward compatibility
    collections: {
      media: true,
      'exercise-assets': true,
    },
    token: blobToken,
  })
}

export const plugins: Plugin[] = [
  redirectsPlugin({
    collections: ['pages'],
    overrides: {
      // @ts-expect-error - This is a valid override, mapped fields don't resolve to the same type
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'from') {
            return {
              ...field,
              admin: {
                description: 'You will need to rebuild the website when changing this field.',
              },
            }
          }
          return field
        })
      },
      hooks: {
        afterChange: [revalidateRedirects],
      },
    },
  }),
  nestedDocsPlugin({
    collections: ['categories'],
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
  }),
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formOverrides: {
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  searchPlugin({
    collections: ['courses', 'posts'],
    beforeSync: beforeSyncWithSearch,
    searchOverrides: {
      fields: ({ defaultFields }) => {
        return [...defaultFields, ...searchFields]
      },
    },
  }),
  ...(vercelBlobPlugin ? [vercelBlobPlugin] : []),
  // Only include MCP plugin when explicitly enabled
  ...(mcp ? [mcp] : []),
]
