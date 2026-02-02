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

// Temporarily disabled - @payloadcms/plugin-mcp not available in dependencies
// TODO: Re-enable when MCP plugin is properly configured
// const mcpEnabled = process.env.MCP_ENABLED === 'true'

// const mcp = mcpEnabled ? require('@/plugins/mcp').mcp : null
const mcp = null

const generateTitle: GenerateTitle<Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | Payload Website Template` : 'Payload Website Template'
}

const generateURL: GenerateURL<Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

// Runtime validation function - called at startup to enforce blob storage
// Skipped during type generation to allow generate:types to run
function validateBlobStorageConfig(): void {
  // Skip validation during type generation
  if (process.env.PAYLOAD_GENERATE_TYPES === 'true') {
    return
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN
  if (!blobToken) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN environment variable is required. ' +
        'Vercel Blob storage is mandatory for this application. ' +
        'Please set BLOB_READ_WRITE_TOKEN in your environment configuration.',
    )
  }
}

// Vercel Blob storage plugin - only created when token is available
// During type generation (PAYLOAD_GENERATE_TYPES=true), this is skipped
let vercelBlobPlugin: Plugin | null = null
if (process.env.PAYLOAD_GENERATE_TYPES !== 'true') {
  validateBlobStorageConfig()

  vercelBlobPlugin = vercelBlobStorage({
    // Enable blob storage for media and exercise-assets collections
    collections: {
      media: true,
      'exercise-assets': true,
    },
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
}

// Export for testing
export { validateBlobStorageConfig }

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
