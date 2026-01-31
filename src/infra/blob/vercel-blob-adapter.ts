/**
 * Vercel Blob Storage Adapter
 *
 * Encapsulates all Vercel Blob operations for consistent storage and retrieval
 * of media files. Works in both Next.js server context and standalone worker context.
 */

import { del, list, put } from '@vercel/blob'
import { getConfigValue } from '../config/runtime/runtime-config'

// Environment variable names
const BLOB_TOKEN_ENV = 'BLOB_READ_WRITE_TOKEN'
const BLOB_READONLY_TOKEN_ENV = 'BLOB_READONLY_TOKEN'

/**
 * Get the appropriate Vercel Blob token from environment
 */
function getBlobToken(readOnly = false): string {
  const token = readOnly ? process.env[BLOB_READONLY_TOKEN_ENV] : process.env[BLOB_TOKEN_ENV]

  if (!token) {
    throw new Error(
      readOnly
        ? `Missing ${BLOB_READONLY_TOKEN_ENV} environment variable`
        : `Missing ${BLOB_TOKEN_ENV} environment variable`,
    )
  }

  return token
}

/**
 * Configuration for blob operations
 */
export interface VercelBlobConfig {
  /** Directory prefix for organized storage (e.g., 'media', 'exercises') */
  directory?: string
  /** Whether this is a public file (accessible without token) */
  public?: boolean
  /** Cache control header value in seconds (0 = no cache) */
  cacheControlSeconds?: number
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<VercelBlobConfig> = {
  directory: 'media',
  public: true,
  cacheControlSeconds: 0,
}

/**
 * Result of a blob upload operation
 */
export interface BlobUploadResult {
  /** The blob URL (public URL if public=true, otherwise presigned URL) */
  url: string
  /** The pathname portion of the URL */
  pathname: string
  /** Content disposition header value */
  contentDisposition?: string
  /** Content type of the file */
  contentType?: string
  /** Size of the file in bytes */
  size?: number
}

/**
 * Result of a blob listing operation
 */
export interface BlobListResult {
  /** List of blobs */
  blobs: Array<{
    url: string
    pathname: string
    size?: number
    contentType?: string
    uploadedAt?: Date
  }>
  /** Cursor for pagination */
  cursor?: string
  /** Whether there are more results */
  hasMore: boolean
}

/**
 * Vercel Blob Adapter
 *
 * Provides a unified interface for Vercel Blob operations with:
 * - Automatic token handling
 * - Directory-based organization
 * - Consistent error handling
 * - Support for both public and private blobs
 */
export class VercelBlobAdapter {
  private readonly config: Required<VercelBlobConfig>
  private readonly token: string

  /**
   * Create a new Vercel Blob adapter instance
   *
   * @param config - Optional configuration overrides
   * @param readOnly - Use read-only token for operations that don't need write access
   */
  constructor(config?: VercelBlobConfig, readOnly = false) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.token = getBlobToken(readOnly)
  }

  /**
   * Build the full pathname with directory prefix
   */
  private buildPathname(filename: string): string {
    const dir = this.config.directory?.replace(/^\/+|\/+$/g, '')
    return dir ? `${dir}/${filename}` : filename
  }

  /**
   * Upload a file to Vercel Blob
   *
   * @param filename - The filename to store (will be prefixed with directory)
   * @param data - The file data (Buffer, ReadableStream, or Blob)
   * @param options - Additional upload options
   * @returns Upload result with URL and metadata
   */
  async upload(
    filename: string,
    data: Buffer | Uint8Array | ReadableStream | Blob,
    options?: {
      contentType?: string
      contentDisposition?: 'attachment' | 'inline'
    },
  ): Promise<BlobUploadResult> {
    const pathname = this.buildPathname(filename)

    // Note: @vercel/blob requires 'public' access for all blobs
    const result = (await put(pathname, data as any, {
      token: this.token,
      access: 'public',
      contentType: options?.contentType,
      cacheControlMaxAge: this.config.cacheControlSeconds,
    })) as any

    return {
      url: result.url,
      pathname: result.pathname,
      contentDisposition: result.contentDisposition,
      contentType: result.contentType,
      size: (result as any).size,
    }
  }

  /**
   * Upload a file from a Buffer with additional metadata
   *
   * @param filename - The filename to store
   * @param buffer - The file data as a Buffer
   * @param contentType - MIME type of the file
   * @returns Upload result
   */
  async uploadBuffer(
    filename: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<BlobUploadResult> {
    return this.upload(filename, buffer, { contentType })
  }

  /**
   * Delete a file from Vercel Blob
   *
   * @param url - The blob URL or pathname to delete
   * @returns True if deletion was successful
   */
  async delete(url: string): Promise<boolean> {
    try {
      await del(url, { token: this.token })
      return true
    } catch (error) {
      console.error(`[VercelBlob] Failed to delete blob: ${url}`, error)
      return false
    }
  }

  /**
   * Delete a file by pathname
   *
   * @param pathname - The pathname (without URL prefix)
   * @returns True if deletion was successful
   */
  async deleteByPathname(pathname: string): Promise<boolean> {
    return this.delete(pathname)
  }

  /**
   * List blobs in a directory
   *
   * @param prefix - Optional prefix to filter results
   * @param limit - Maximum number of results (default 100)
   * @param cursor - Pagination cursor from previous call
   * @returns List result with blobs and pagination info
   */
  async list(prefix?: string, limit = 100, cursor?: string): Promise<BlobListResult> {
    const searchPrefix = prefix ? this.buildPathname(prefix) : `${this.config.directory}/`

    const result = await list({
      token: this.token,
      prefix: searchPrefix,
      limit,
      cursor,
    })

    return {
      blobs: result.blobs.map((blob) => ({
        url: blob.url,
        pathname: blob.pathname,
        size: (blob as any).size,
        contentType: (blob as any).contentType,
        uploadedAt: (blob as any).uploadedAt,
      })),
      cursor: result.cursor,
      hasMore: !!result.cursor,
    }
  }

  /**
   * Check if a blob exists
   *
   * @param url - The blob URL to check
   * @returns True if the blob exists
   */
  async exists(url: string): Promise<boolean> {
    try {
      // Use list with limit 1 to check existence
      const pathname = url.replace(/^https?:\/\/[^\/]+/, '')
      const result = await list({
        token: this.token,
        prefix: pathname.split('?')[0], // Remove query params
        limit: 1,
      })
      return result.blobs.length > 0
    } catch {
      return false
    }
  }

  /**
   * Get blob metadata by URL
   *
   * @param url - The blob URL
   * @returns Blob metadata or null if not found
   */
  async getMetadata(url: string): Promise<{
    pathname: string
    size?: number
    contentType?: string
    uploadedAt?: Date
  } | null> {
    try {
      const pathname = url.replace(/^https?:\/\/[^\/]+/, '')
      const result = await list({
        token: this.token,
        prefix: pathname.split('?')[0],
        limit: 1,
      })

      if (result.blobs.length === 0) {
        return null
      }

      const blob = result.blobs[0]
      return {
        pathname: blob.pathname,
        size: (blob as any).size,
        contentType: (blob as any).contentType,
        uploadedAt: (blob as any).uploadedAt,
      }
    } catch {
      return null
    }
  }

  /**
   * Generate a signed URL for private blobs
   *
   * @param url - The blob URL
   * @param expiresIn - Expiration time in seconds (max 604800 = 7 days)
   * @returns Signed URL with download token
   */
  async getSignedUrl(
    url: string,
    _expiresIn = 3600, // 1 hour default (reserved for future use)
  ): Promise<string> {
    // Note: @vercel/blob's put() returns a URL that may already be signed
    // For existing blobs, we need to use the download API
    // This is a placeholder for when we implement proper signed URL generation
    return url
  }
}

/**
 * Default adapter instance for media storage (lazy-loaded to avoid env var requirement during postinstall)
 */
let _mediaBlobAdapter: VercelBlobAdapter | null = null
export function getMediaBlobAdapter(): VercelBlobAdapter {
  if (!_mediaBlobAdapter) {
    _mediaBlobAdapter = new VercelBlobAdapter({
      directory: 'media',
      public: true,
    })
  }
  return _mediaBlobAdapter
}

/**
 * Default adapter instance for exercise assets (lazy-loaded to avoid env var requirement during postinstall)
 */
let _exerciseAssetsBlobAdapter: VercelBlobAdapter | null = null
export function getExerciseAssetsBlobAdapter(): VercelBlobAdapter {
  if (!_exerciseAssetsBlobAdapter) {
    _exerciseAssetsBlobAdapter = new VercelBlobAdapter({
      directory: 'exercise-assets',
      public: true,
    })
  }
  return _exerciseAssetsBlobAdapter
}

/**
 * Adapter instance for private files (lazy-loaded to avoid env var requirement during postinstall)
 */
let _privateBlobAdapter: VercelBlobAdapter | null = null
export function getPrivateBlobAdapter(): VercelBlobAdapter {
  if (!_privateBlobAdapter) {
    _privateBlobAdapter = new VercelBlobAdapter({
      directory: 'private',
      public: false,
    })
  }
  return _privateBlobAdapter
}

/**
 * Helper function to check if a URL is a Vercel Blob URL
 */
export function isVercelBlobUrl(url: string): boolean {
  return url.includes('.blob.vercel-storage.com') || url.includes('public.blob.vercel-storage.com')
}

/**
 * Get the external storage base URL for constructing absolute URLs
 *
 * Resolution order:
 * 1. ConfigEntries with key 'NEXT_PUBLIC_EXTERNAL_STORAGE_URL' (default tenant)
 * 2. NEXT_PUBLIC_SERVER_URL environment variable
 * 3. NEXT_PUBLIC_DEPLOYMENT_URL environment variable
 * 4. http://localhost:3000 (development fallback)
 */
export async function getExternalStorageUrl(): Promise<string> {
  // Try ConfigEntries first (requires loadRuntimeConfig to have been called)
  const configValue = await getConfigValue('NEXT_PUBLIC_EXTERNAL_STORAGE_URL')
  if (configValue) {
    return configValue.replace(/\/$/, '')
  }

  // Fallback to environment variables
  if (process.env.NEXT_PUBLIC_SERVER_URL) {
    return process.env.NEXT_PUBLIC_SERVER_URL.replace(/\/$/, '')
  }

  if (process.env.NEXT_PUBLIC_DEPLOYMENT_URL) {
    return process.env.NEXT_PUBLIC_DEPLOYMENT_URL.replace(/\/$/, '')
  }

  // Last resort: use localhost for development
  return 'http://localhost:3000'
}

/**
 * Helper function to extract the pathname from a Vercel Blob URL
 */
export function getBlobPathname(url: string): string {
  const match = url.match(/\.blob\.vercel-storage\.com\/(.+?)(\?|$)/)
  return match ? match[1] : url
}

/**
 * Create adapter with a custom specific configuration
 */
export function createBlobAdapter(config: VercelBlobConfig): VercelBlobAdapter {
  return new VercelBlobAdapter(config)
}

/**
 * Upload PDF buffer to Vercel Blob
 *
 * @param pdfBuffer - The PDF file data
 * @param filename - The filename to store
 * @param options - Additional options
 * @returns Upload result with URL
 */
export async function uploadPdfBuffer(
  pdfBuffer: Buffer,
  filename: string,
  options?: { directory?: string },
): Promise<BlobUploadResult> {
  const adapter = new VercelBlobAdapter({
    directory: options?.directory || 'media/pdfs',
    public: true,
  })

  return adapter.uploadBuffer(filename, pdfBuffer, 'application/pdf')
}

/**
 * Get PDF buffer from Vercel Blob URL
 *
 * @param url - The blob URL
 * @returns PDF buffer
 */
export async function getPdfBufferFromUrl(url: string): Promise<Buffer> {
  // Validate it's a Vercel Blob URL
  if (!isVercelBlobUrl(url)) {
    throw new Error(`Invalid Vercel Blob URL: ${url}`)
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Upload a file from a File/Blob object (for browser uploads)
 *
 * @param file - The browser File/Blob object
 * @param filename - The filename to store
 * @param directory - The directory prefix
 * @returns Upload result
 */
export async function uploadBrowserFile(
  file: File,
  filename: string,
  directory = 'media',
): Promise<BlobUploadResult> {
  const adapter = new VercelBlobAdapter({
    directory,
    public: true,
  })

  // Convert File to Buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  return adapter.uploadBuffer(filename, buffer, file.type)
}
