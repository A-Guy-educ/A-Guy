import { getPreviewSecret } from '@/infra/auth/oauth-secrets'
import { CollectionSlug, PayloadRequest } from 'payload'

const collectionPrefixMap: Partial<Record<CollectionSlug, string>> = {
  pages: '',
}

type Props = {
  collection: keyof typeof collectionPrefixMap
  slug: string
  req: PayloadRequest
}

export const generatePreviewPath = async ({ collection, slug, req }: Props) => {
  // Allow empty strings, e.g. for the homepage
  if (slug === undefined || slug === null) {
    return null
  }

  // Encode to support slugs with special characters
  const encodedSlug = encodeURIComponent(slug)

  // Get preview secret from tenant-scoped config with env fallback
  const previewSecret = await getPreviewSecret(req.payload)

  const encodedParams = new URLSearchParams({
    slug: encodedSlug,
    collection,
    path: `${collectionPrefixMap[collection]}/${encodedSlug}`,
    previewSecret,
  })

  const url = `/next/preview?${encodedParams.toString()}`

  return url
}
