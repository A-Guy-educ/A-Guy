# StaticAssets System - Implementation Plan

> Low-level implementation plan based on [spec.md](./spec.md)
>
> **Last Updated**: 2025-01-19

---

## Scope Clarification

**This document is the ONLY source of truth for this task.**

### What v1 Delivers (Stages 1-5)

1. **StaticAssets CMS Infrastructure** (Stages 1-4)
   - `static-assets` collection with explicit `assetType: single | bundle` field
   - Activation workflow: single-active per `(key, assetType)`
   - Bundle support with **inline manifest only** (Option A)
   - Resolver layer with caching

2. **PDF.js Viewer Route Refactor** (Stage 5)
   - Refactor `/api/pdfjs-viewer` to load assets via StaticAssets resolver
   - Remove all hardcoded CDN URLs/hashes from `src/lib/pdfjs/config.ts`
   - **Note**: Do NOT rebuild PDF.js rendering logic—only change how assets are loaded

### Out of Scope (v2)

- **manifestPath in Blob** (Option B) — v1 uses inline manifest only
- **Runtime JS/CSS auto-loading** (Stage 6) — deferred
- CSS can be uploaded as a file type but won't auto-load

### Implementation Principles

| Principle                | Enforcement                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------- |
| **CMS is write-side**    | Upload, versioning, activation, audit trail, manifest storage                           |
| **Runtime is read-only** | Resolver only: `getActiveStaticAsset(key)` / `getActiveStaticBundle(key)`               |
| **No hardcoding**        | All runtime code resolves assets via resolver—no paths, hashes, or implicit assumptions |
| **Deterministic**        | Hard fail if manifest missing/invalid (no guessing)                                     |
| **Easy rollback**        | Switch `active` version without redeploy                                                |

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Stage 1: Core Collection](#stage-1-core-collection)
3. [Stage 2: Activation Workflow](#stage-2-activation-workflow)
4. [Stage 3: Bundle Support](#stage-3-bundle-support)
5. [Stage 4: Resolver Layer](#stage-4-resolver-layer)
6. [Stage 5: PDF Viewer Route Refactor](#stage-5-pdf-viewer-route-refactor)
7. [Test Strategy](#test-strategy)
8. [Migration & Seeding](#migration--seeding)
9. [Out of Scope (v2)](#out-of-scope-v2)

---

## Architecture Overview

### Responsibility Split

| Layer                  | Responsibility                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------- |
| **CMS (Admin)**        | Upload, versioning, activation, audit trail, manifest storage                          |
| **Runtime (Resolver)** | `getActiveStaticAsset(key)` / `getActiveStaticBundle(key)` with caching                |
| **Consumers**          | Use resolver only, never hardcode paths/hashes, never infer structure without manifest |

### Key Design Decisions

1. **Single Collection**: One `static-assets` collection for both single files and bundles
2. **Explicit `assetType`**: Field distinguishes `single` vs `bundle` (not inferred from category)
3. **Inline Manifest Only** (v1): Store `manifest` JSON directly on the Payload record
4. **Activation Rule**: Only one `active` per `(key, assetType)`
5. **Version Uniqueness**: Only one version per `(key, assetType, version)` — prevents duplicate uploads
6. **Deterministic Resolution**: Hard fail if manifest missing/invalid (no guessing)
7. **Easy Rollback**: Activate any previous version without redeploy

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Admin Panel                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Upload Asset    │  │ Upload Bundle   │  │ Activate        │ │
│  │ (single file)   │  │ (ZIP + manifest)│  │ (admin action)  │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
└───────────┼─────────────────────┼─────────────────────┼─────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  static-assets Collection                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ key: "pdfjs-viewer"                                      │   │
│  │ assetType: "bundle"        ◄── Explicit, not inferred    │   │
│  │ category: "other"          ◄── Real file type only       │   │
│  │ version: "4.4.168"                                       │   │
│  │ status: "active"                                         │   │
│  │ baseUrl: "https://...blob.vercel-storage.com/static-..." │   │
│  │ manifest: { paths: { viewerHtml, viewerMjs, ... } }      │   │
│  │ checksumSha256: "abc123..."                              │   │
│  │ activatedBy: <user-ref>                                  │   │
│  │ activatedAt: 2025-01-15T10:00:00Z                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
            │
            │ getActiveStaticBundle('pdfjs-viewer')
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Resolver Layer                               │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ In-Memory Cache  │◀─│ TTL: 5 minutes   │                     │
│  │ key → asset      │  │ Invalidate on    │                     │
│  └────────┬─────────┘  │ collection change│                     │
│           │            └──────────────────┘                     │
│           ▼                                                     │
│  Manifest Resolution:                                           │
│  1. manifest (inline JSON) → validate → return                  │
│  2. Missing/invalid → HARD FAIL (500)                           │
│                                                                 │
│  Returns: { baseUrl, version, manifest, checksumSha256 }        │
└─────────────────────────────────────────────────────────────────┘
            │
            │ Used by consumers (e.g., pdfjs-viewer route)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Consumer: /api/pdfjs-viewer Route                   │
│  (Stage 5 - Refactored to use StaticAssets)                     │
│  1. Call getActiveStaticBundle('pdfjs-viewer')                  │
│  2. Build URLs from baseUrl + manifest.paths                    │
│  3. Never hardcode paths or hashes                              │
│  4. Remove hardcoded config from src/lib/pdfjs/config.ts        │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure (New Files)

```
src/
├── collections/
│   └── StaticAssets.ts                     # Stage 1
├── access/
│   └── isAdmin.ts                          # Stage 1 (if not exists)
├── fields/
│   └── activatedBy.ts                      # Stage 1
├── lib/
│   └── static-assets/
│       ├── types.ts                        # Stage 1 (shared types)
│       ├── validation.ts                   # Stage 1 (key, manifest schemas)
│       ├── checksum.ts                     # Stage 1 (SHA-256 computation)
│       ├── activation.ts                   # Stage 2 (activation logic)
│       ├── bundle-processor.ts             # Stage 3 (ZIP extraction)
│       └── resolver.ts                     # Stage 4 (getActiveStaticAsset/Bundle)
├── endpoints/
│   └── static-assets/
│       └── activate.ts                     # Stage 2 (custom endpoint)

tests/
├── unit/
│   ├── static-assets-validation.spec.ts   # Stage 1
│   ├── static-assets-checksum.spec.ts     # Stage 1
│   ├── static-assets-activation.spec.ts   # Stage 2
│   ├── bundle-processor.spec.ts           # Stage 3
│   ├── resolver.spec.ts                   # Stage 4
│   └── pdfjs-viewer-route.spec.ts         # Stage 5 (unit test with NextRequest)
└── int/
    ├── static-assets-collection.int.spec.ts  # Stage 1
    └── static-assets-activate.int.spec.ts    # Stage 2

scripts/
└── seed-pdfjs-bundle.ts                    # Stage 3
```

---

## Stage 1: Core Collection

### 1.1 Create `src/access/isAdmin.ts`

```typescript
import type { Access } from 'payload'
import type { User } from '@/payload-types'
import { AccountRole } from '@/collections/Users/roles'

export const isAdmin: Access = ({ req }) => {
  const user = req.user as User | null
  return user?.role === AccountRole.Admin
}
```

### 1.2 Create `src/lib/static-assets/types.ts`

```typescript
/**
 * StaticAssets Types
 * Shared type definitions for the static assets system
 */

/**
 * Asset type - explicitly distinguishes single files from bundles
 * DO NOT infer this from category
 */
export const ASSET_TYPES = ['single', 'bundle'] as const
export type AssetType = (typeof ASSET_TYPES)[number]

/**
 * Category describes the content type, NOT the structure.
 * Do NOT use category to determine single vs bundle—use assetType instead.
 */
export const ASSET_CATEGORIES = [
  'image',
  'svg',
  'font',
  'json',
  'pdf',
  'css',
  'js',
  'other',
] as const

export type AssetCategory = (typeof ASSET_CATEGORIES)[number]

export const ASSET_STATUSES = ['draft', 'active', 'archived'] as const

export type AssetStatus = (typeof ASSET_STATUSES)[number]

/**
 * Manifest schema for bundles (e.g., PDF.js viewer)
 * Extensible for other bundle types
 */
export interface BundleManifest {
  version: string
  paths: {
    // Required for PDF.js viewer bundles
    viewerHtml?: string
    viewerMjs?: string
    viewerCss?: string
    pdfMjs?: string
    workerMjs?: string
    webBase?: string
    // Generic paths for other bundle types
    [key: string]: string | undefined
  }
  integrity?: Record<string, string> // Optional SRI hashes
}

/**
 * Resolved static asset (single file)
 */
export interface ResolvedStaticAsset {
  id: string
  key: string
  assetType: 'single'
  category: AssetCategory
  version: string
  publicUrl: string
  contentType: string
  checksumSha256: string
}

/**
 * Resolved static bundle
 */
export interface ResolvedStaticBundle {
  id: string
  key: string
  assetType: 'bundle'
  category: AssetCategory
  version: string
  baseUrl: string
  contentType: string
  checksumSha256: string
  manifest: BundleManifest
}
```

### 1.3 Create `src/lib/static-assets/validation.ts`

```typescript
import { z } from 'zod'
import type { BundleManifest } from './types'

/**
 * Key validation
 * Must be lowercase alphanumeric with hyphens, 3-50 chars
 * Examples: "pdfjs-viewer", "theme-main-css", "logo-svg"
 */
export const KEY_REGEX = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/

export function validateKey(key: string): { valid: true } | { valid: false; error: string } {
  if (!key) {
    return { valid: false, error: 'Key is required' }
  }
  if (key.length < 3 || key.length > 50) {
    return { valid: false, error: 'Key must be 3-50 characters' }
  }
  if (!KEY_REGEX.test(key)) {
    return {
      valid: false,
      error: 'Key must be lowercase alphanumeric with hyphens (no leading/trailing hyphens)',
    }
  }
  // Prevent path traversal
  if (key.includes('..') || key.includes('/') || key.includes('\\')) {
    return { valid: false, error: 'Key cannot contain path separators' }
  }
  return { valid: true }
}

/**
 * Version validation
 * Semantic version or timestamp format
 */
export const VERSION_REGEX = /^[a-z0-9][a-z0-9._-]{0,48}[a-z0-9]$|^[a-z0-9]$/i

export function validateVersion(
  version: string,
): { valid: true } | { valid: false; error: string } {
  if (!version) {
    return { valid: false, error: 'Version is required' }
  }
  if (version.length > 50) {
    return { valid: false, error: 'Version must be 50 characters or less' }
  }
  if (!VERSION_REGEX.test(version)) {
    return {
      valid: false,
      error: 'Version must be alphanumeric with dots, underscores, or hyphens',
    }
  }
  if (version.includes('/') || version.includes('\\') || version.includes('..')) {
    return { valid: false, error: 'Version cannot contain path separators' }
  }
  return { valid: true }
}

/**
 * Manifest schema for Zod validation
 * Flexible to support various bundle types
 */
export const BundleManifestSchema = z.object({
  version: z.string().min(1, 'Manifest version is required'),
  paths: z
    .record(z.string())
    .refine((paths) => Object.keys(paths).length > 0, 'Manifest must have at least one path'),
  integrity: z.record(z.string()).optional(),
})

/**
 * PDF.js viewer-specific manifest schema (stricter)
 */
export const PdfjsManifestSchema = z.object({
  version: z.string().min(1, 'Manifest version is required'),
  paths: z.object({
    viewerHtml: z.string().min(1, 'viewerHtml path is required'),
    viewerMjs: z.string().min(1, 'viewerMjs path is required'),
    viewerCss: z.string().min(1, 'viewerCss path is required'),
    pdfMjs: z.string().min(1, 'pdfMjs path is required'),
    workerMjs: z.string().optional(),
    webBase: z.string().optional(),
  }),
  integrity: z.record(z.string()).optional(),
})

export function validateManifest(
  manifest: unknown,
  strict = false,
): { valid: true; data: BundleManifest } | { valid: false; error: string } {
  const schema = strict ? PdfjsManifestSchema : BundleManifestSchema
  const result = schema.safeParse(manifest)
  if (!result.success) {
    const firstError = result.error.errors[0]
    return {
      valid: false,
      error: `Invalid manifest: ${firstError?.path.join('.')} - ${firstError?.message}`,
    }
  }
  return { valid: true, data: result.data as BundleManifest }
}

/**
 * Validate paths in manifest don't escape bundle directory
 */
export function validateManifestPaths(
  manifest: BundleManifest,
): { valid: true } | { valid: false; error: string } {
  const paths = Object.values(manifest.paths).filter(Boolean) as string[]

  for (const path of paths) {
    // Paths should be relative within the bundle
    if (path.startsWith('/') || path.startsWith('http')) {
      return { valid: false, error: `Path must be relative: ${path}` }
    }
    if (path.includes('..')) {
      return { valid: false, error: `Path cannot contain "..": ${path}` }
    }
  }

  return { valid: true }
}
```

### 1.4 Create `src/lib/static-assets/checksum.ts`

```typescript
import { createHash } from 'crypto'

/**
 * Compute SHA-256 checksum of a buffer
 * Returns hex-encoded string
 */
export function computeSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Compute SHA-256 checksum from a stream
 * For large files, prefer streaming
 */
export async function computeSha256Stream(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    stream.on('data', (data) => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * Generate SRI hash for subresource integrity
 * Format: sha256-<base64-hash>
 */
export function generateSriHash(buffer: Buffer): string {
  const hash = createHash('sha256').update(buffer).digest('base64')
  return `sha256-${hash}`
}
```

### 1.5 Create `src/fields/activatedBy.ts`

```typescript
import type { Field } from 'payload'

/**
 * Activated By field
 * Set when an asset is activated, read-only after
 */
export const activatedByField: Field = {
  name: 'activatedBy',
  type: 'relationship',
  relationTo: 'users',
  access: {
    update: () => false, // Cannot be manually changed
  },
  admin: {
    position: 'sidebar',
    readOnly: true,
    description: 'User who activated this asset',
  },
}

/**
 * Activated At field
 * Timestamp when asset was activated
 */
export const activatedAtField: Field = {
  name: 'activatedAt',
  type: 'date',
  access: {
    update: () => false,
  },
  admin: {
    position: 'sidebar',
    readOnly: true,
    description: 'When this asset was activated',
    date: {
      pickerAppearance: 'dayAndTime',
    },
  },
}
```

### 1.6 Create `src/collections/StaticAssets.ts`

```typescript
import type { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isAdmin } from '@/access/isAdmin'
import { createdByField } from '@/fields/createdBy'
import { activatedByField, activatedAtField } from '@/fields/activatedBy'
import { ASSET_TYPES, ASSET_CATEGORIES, ASSET_STATUSES } from '@/lib/static-assets/types'
import {
  validateKey,
  validateVersion,
  validateManifest,
  validateManifestPaths,
} from '@/lib/static-assets/validation'
import { computeSha256 } from '@/lib/static-assets/checksum'

export const StaticAssets: CollectionConfig = {
  slug: 'static-assets',
  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'assetType', 'category', 'version', 'status', 'updatedAt'],
    group: 'System',
    description: 'Versioned static assets (images, fonts, bundles)',
  },
  access: {
    create: isAdmin,
    read: anyone, // Resolver needs read access
    update: isAdmin,
    delete: isAdmin,
  },
  // STORAGE RULE: Vercel Blob is authoritative; local disk is NOT used in production.
  // The Vercel Blob plugin (see plugins/index.ts) intercepts all uploads and stores
  // files in Vercel Blob storage. The upload.staticDir below is ONLY used as a
  // collection identifier for the plugin mapping, not as an actual file path.
  upload: {
    staticDir: 'static-assets', // Plugin identifier only—files go to Blob, not disk
    mimeTypes: [
      // Images
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Fonts
      'font/woff',
      'font/woff2',
      'font/ttf',
      'font/otf',
      // Documents
      'application/pdf',
      'application/json',
      // Code (admin-only) - accept both text/javascript and application/javascript
      // as browsers and tools may use either MIME type
      'text/css',
      'text/javascript',
      'application/javascript',
      // Bundles
      'application/zip',
      'application/x-zip-compressed',
    ],
  },
  hooks: {
    beforeValidate: [
      // Validate key format
      ({ data, operation }) => {
        if (operation === 'create' || data?.key) {
          const keyValidation = validateKey(data?.key || '')
          if (!keyValidation.valid) {
            throw new Error(keyValidation.error)
          }
        }
        return data
      },
      // Validate version format
      ({ data, operation }) => {
        if (operation === 'create' || data?.version) {
          const versionValidation = validateVersion(data?.version || '')
          if (!versionValidation.valid) {
            throw new Error(versionValidation.error)
          }
        }
        return data
      },
    ],
    beforeChange: [
      // Compute checksumSha256 and set contentType on file upload
      async ({ data, req, operation }) => {
        if (operation === 'create' && req.file) {
          const buffer = req.file.data
          data.checksumSha256 = computeSha256(buffer)
          data.contentType = req.file.mimetype
          data.fileSize = buffer.length
        }
        return data
      },
      // Set createdBy on create
      ({ data, req, operation }) => {
        if (operation === 'create' && req.user) {
          data.createdBy = req.user.id
        }
        return data
      },
      // Validate manifest for bundles (REQUIRED for bundles)
      // Use strict=true for pdfjs-viewer to ensure all required paths are present
      ({ data }) => {
        if (data?.assetType === 'bundle') {
          if (!data?.manifest) {
            throw new Error('Manifest is required for bundle assets')
          }
          // Use strict validation for pdfjs-viewer (requires viewerHtml, viewerMjs, etc.)
          const useStrict = data.key === 'pdfjs-viewer'
          const manifestValidation = validateManifest(data.manifest, useStrict)
          if (!manifestValidation.valid) {
            throw new Error(manifestValidation.error)
          }
          const pathsValidation = validateManifestPaths(manifestValidation.data)
          if (!pathsValidation.valid) {
            throw new Error(pathsValidation.error)
          }
        }
        return data
      },
    ],
    afterChange: [
      // Invalidate resolver cache when asset changes
      async ({ doc }) => {
        // Import dynamically to avoid circular deps
        const { invalidateCache } = await import('@/lib/static-assets/resolver')
        invalidateCache(doc.key)
      },
    ],
  },
  fields: [
    // ========================================
    // Core Fields
    // ========================================
    {
      name: 'key',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Stable identifier (e.g., "pdfjs-viewer", "theme-main-css")',
      },
    },
    {
      name: 'assetType',
      type: 'select',
      required: true,
      options: ASSET_TYPES.map((type) => ({ label: type, value: type })),
      defaultValue: 'single',
      admin: {
        description:
          'Asset structure: "single" for individual files, "bundle" for ZIP archives with manifest',
      },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: ASSET_CATEGORIES.map((cat) => ({ label: cat, value: cat })),
      index: true,
      admin: {
        description: 'Content type category (does NOT determine structure)',
      },
    },
    {
      name: 'version',
      type: 'text',
      required: true,
      admin: {
        description: 'Version identifier (e.g., "4.4.168", "2025-01-15")',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: ASSET_STATUSES.map((status) => ({ label: status, value: status })),
      index: true,
      admin: {
        description: 'Asset status (only one active per key)',
      },
    },

    // ========================================
    // Read-Only Computed Fields
    // ========================================
    {
      name: 'publicUrl',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Public CDN URL for single-file assets',
        condition: (data) => data?.assetType === 'single',
      },
      access: {
        update: () => false,
      },
    },
    {
      name: 'baseUrl',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Base URL for bundle assets',
        condition: (data) => data?.assetType === 'bundle',
      },
      access: {
        update: () => false,
      },
    },
    {
      name: 'contentType',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'MIME type of the uploaded file',
      },
      access: {
        update: () => false,
      },
    },
    {
      name: 'checksumSha256',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'SHA-256 checksum of the file',
      },
      access: {
        update: () => false,
      },
    },
    {
      name: 'fileSize',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'File size in bytes',
      },
      access: {
        update: () => false,
      },
    },

    // ========================================
    // Bundle-Specific Fields (v1: Inline Manifest Only)
    // ========================================
    {
      name: 'manifest',
      type: 'json',
      admin: {
        description: 'Bundle manifest JSON (required for bundles)',
        condition: (data) => data?.assetType === 'bundle',
      },
    },

    // ========================================
    // Audit Fields
    // ========================================
    createdByField,
    activatedByField,
    activatedAtField,
  ],
  timestamps: true,
}
```

### 1.7 Register Collection in Payload Config

Update `payload.config.ts`:

```typescript
import { StaticAssets } from '@/collections/StaticAssets'

// Add to collections array
collections: [
  // ... existing collections
  StaticAssets,
]
```

### 1.8 Add to Vercel Blob Plugin

Update `src/plugins/index.ts`:

```typescript
vercelBlobStorage({
  collections: {
    media: true,
    'exercise-assets': true,
    'static-assets': true,  // ADD THIS
  },
  token: process.env.BLOB_READ_WRITE_TOKEN || '',
}),
```

### 1.9 Unit Tests for Stage 1

Create `tests/unit/static-assets-validation.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  validateKey,
  validateVersion,
  validateManifest,
  validateManifestPaths,
} from '@/lib/static-assets/validation'

describe('StaticAssets Validation', () => {
  describe('validateKey', () => {
    it('accepts valid keys', () => {
      expect(validateKey('pdfjs-viewer')).toEqual({ valid: true })
      expect(validateKey('theme-main-css')).toEqual({ valid: true })
      expect(validateKey('logo')).toEqual({ valid: true })
    })

    it('rejects keys too short', () => {
      expect(validateKey('ab').valid).toBe(false)
    })

    it('rejects keys with invalid characters', () => {
      expect(validateKey('PDF_Viewer').valid).toBe(false) // uppercase
      expect(validateKey('pdf.viewer').valid).toBe(false) // dot
      expect(validateKey('pdf viewer').valid).toBe(false) // space
    })

    it('rejects path traversal attempts', () => {
      expect(validateKey('../evil').valid).toBe(false)
      expect(validateKey('foo/bar').valid).toBe(false)
    })

    it('rejects leading/trailing hyphens', () => {
      expect(validateKey('-pdfjs').valid).toBe(false)
      expect(validateKey('pdfjs-').valid).toBe(false)
    })
  })

  describe('validateVersion', () => {
    it('accepts valid versions', () => {
      expect(validateVersion('4.4.168')).toEqual({ valid: true })
      expect(validateVersion('2025-01-15')).toEqual({ valid: true })
      expect(validateVersion('v1.0.0')).toEqual({ valid: true })
    })

    it('rejects versions with path separators', () => {
      expect(validateVersion('1.0/evil').valid).toBe(false)
      expect(validateVersion('../up').valid).toBe(false)
    })
  })

  describe('validateManifest', () => {
    const validManifest = {
      version: '4.4.168',
      paths: {
        viewerHtml: 'web/viewer.html',
        viewerMjs: 'web/viewer.mjs',
        viewerCss: 'web/viewer.css',
        pdfMjs: 'build/pdf.mjs',
      },
    }

    it('accepts valid manifest', () => {
      const result = validateManifest(validManifest)
      expect(result.valid).toBe(true)
    })

    it('rejects manifest without paths', () => {
      const invalid = { version: '1.0', paths: {} }
      const result = validateManifest(invalid)
      expect(result.valid).toBe(false)
    })

    it('rejects manifest without version', () => {
      const invalid = { paths: validManifest.paths }
      const result = validateManifest(invalid)
      expect(result.valid).toBe(false)
    })
  })

  describe('validateManifestPaths', () => {
    it('accepts relative paths', () => {
      const manifest = {
        version: '1.0',
        paths: {
          viewerHtml: 'web/viewer.html',
          viewerMjs: 'web/viewer.mjs',
        },
      }
      expect(validateManifestPaths(manifest)).toEqual({ valid: true })
    })

    it('rejects absolute paths', () => {
      const manifest = {
        version: '1.0',
        paths: {
          viewerHtml: '/web/viewer.html',
        },
      }
      expect(validateManifestPaths(manifest).valid).toBe(false)
    })

    it('rejects path traversal', () => {
      const manifest = {
        version: '1.0',
        paths: {
          viewerHtml: '../evil/viewer.html',
        },
      }
      expect(validateManifestPaths(manifest).valid).toBe(false)
    })
  })
})
```

Create `tests/unit/static-assets-checksum.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeSha256, generateSriHash } from '@/lib/static-assets/checksum'

describe('Checksum Utilities', () => {
  describe('computeSha256', () => {
    it('computes correct SHA-256 for known input', () => {
      const buffer = Buffer.from('hello world')
      const hash = computeSha256(buffer)
      // SHA-256 of "hello world"
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
    })

    it('returns different hashes for different inputs', () => {
      const hash1 = computeSha256(Buffer.from('test1'))
      const hash2 = computeSha256(Buffer.from('test2'))
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('generateSriHash', () => {
    it('generates valid SRI hash format', () => {
      const buffer = Buffer.from('hello world')
      const sri = generateSriHash(buffer)
      expect(sri).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/)
    })
  })
})
```

---

## Stage 2: Activation Workflow

### 2.1 Create `src/lib/static-assets/activation.ts`

```typescript
import type { Payload } from 'payload'
import type { User, StaticAsset } from '@/payload-types'
import { logger } from '@/utilities/logger'

export interface ActivationResult {
  success: boolean
  asset?: StaticAsset
  previousAsset?: StaticAsset
  error?: string
}

/**
 * Activate a static asset
 *
 * - Archives any previously active asset with same (key, assetType)
 * - Sets the target asset to 'active'
 * - Records activatedBy and activatedAt
 *
 * Activation rule: Only one `active` per (key, assetType)
 *
 * Idempotency: This function is NOT idempotent by design.
 * If the asset is already active, it returns an error.
 * Rationale: Activation is an explicit action with audit trail implications.
 * Re-activating an already-active asset would update activatedAt/activatedBy
 * without any state change, which could be confusing in audit logs.
 * Callers should check asset.status before calling if they want to skip.
 */
export async function activateStaticAsset(
  payload: Payload,
  assetId: string,
  activatedByUser: User,
): Promise<ActivationResult> {
  const activationLogger = logger.child({ component: 'static-assets-activation', assetId })

  try {
    // 1. Fetch the asset to activate
    const asset = await payload.findByID({
      collection: 'static-assets',
      id: assetId,
    })

    if (!asset) {
      return { success: false, error: 'Asset not found' }
    }

    if (asset.status === 'active') {
      return { success: false, error: 'Asset is already active' }
    }

    activationLogger.info(
      { key: asset.key, version: asset.version, assetType: asset.assetType },
      'Activating asset',
    )

    // 2. Find and archive the currently active asset with same (key, assetType)
    const activeAssets = await payload.find({
      collection: 'static-assets',
      where: {
        and: [
          { key: { equals: asset.key } },
          { assetType: { equals: asset.assetType } },
          { status: { equals: 'active' } },
          { id: { not_equals: assetId } },
        ],
      },
      limit: 1,
    })

    let previousAsset: StaticAsset | undefined

    if (activeAssets.docs.length > 0) {
      previousAsset = activeAssets.docs[0] as StaticAsset

      activationLogger.info(
        { previousId: previousAsset.id, previousVersion: previousAsset.version },
        'Archiving previous active asset',
      )

      await payload.update({
        collection: 'static-assets',
        id: previousAsset.id,
        data: {
          status: 'archived',
        },
        context: { skipCacheInvalidation: true },
      })
    }

    // 3. Activate the new asset
    const updatedAsset = await payload.update({
      collection: 'static-assets',
      id: assetId,
      data: {
        status: 'active',
        activatedBy: activatedByUser.id,
        activatedAt: new Date().toISOString(),
      },
    })

    activationLogger.info(
      { key: asset.key, version: asset.version },
      'Asset activated successfully',
    )

    return {
      success: true,
      asset: updatedAsset as StaticAsset,
      previousAsset,
    }
  } catch (error) {
    activationLogger.error({ error }, 'Failed to activate asset')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

### 2.2 Create Custom Endpoint `src/endpoints/static-assets/activate.ts`

```typescript
import type { PayloadHandler } from 'payload'
import { activateStaticAsset } from '@/lib/static-assets/activation'
import { AccountRole } from '@/collections/Users/roles'
import { logger } from '@/utilities/logger'

/**
 * POST /api/static-assets/:id/activate
 *
 * Admin-only endpoint to activate a static asset.
 */
export const activateHandler: PayloadHandler = async (req) => {
  const endpointLogger = logger.child({ component: 'activate-endpoint' })

  if (!req.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (req.user.role !== AccountRole.Admin) {
    return Response.json({ error: 'Forbidden - Admin only' }, { status: 403 })
  }

  const assetId = req.routeParams?.id
  if (!assetId || typeof assetId !== 'string') {
    return Response.json({ error: 'Missing asset ID' }, { status: 400 })
  }

  endpointLogger.info({ assetId, userId: req.user.id }, 'Activation request received')

  const result = await activateStaticAsset(req.payload, assetId, req.user)

  if (!result.success) {
    endpointLogger.warn({ assetId, error: result.error }, 'Activation failed')
    return Response.json({ error: result.error }, { status: 400 })
  }

  endpointLogger.info(
    {
      assetId,
      key: result.asset?.key,
      version: result.asset?.version,
      previousVersion: result.previousAsset?.version,
    },
    'Activation successful',
  )

  return Response.json({
    success: true,
    asset: result.asset,
    previousAsset: result.previousAsset
      ? { id: result.previousAsset.id, version: result.previousAsset.version }
      : null,
  })
}
```

### 2.3 Register Endpoint in Collection

Update `src/collections/StaticAssets.ts`:

```typescript
import { activateHandler } from '@/endpoints/static-assets/activate'

export const StaticAssets: CollectionConfig = {
  slug: 'static-assets',
  // ... existing config
  endpoints: [
    {
      path: '/:id/activate',
      method: 'post',
      handler: activateHandler,
    },
  ],
  // ... rest of config
}
```

### 2.4 Add MongoDB Unique Index

Create `scripts/create-static-assets-indexes.ts`:

```typescript
/**
 * Create MongoDB indexes for static-assets collection
 *
 * Run with: pnpm tsx scripts/create-static-assets-indexes.ts
 *
 * Creates a partial unique index to enforce only one active asset per key.
 */
import { MongoClient } from 'mongodb'

async function createIndexes() {
  const uri = process.env.DATABASE_URI || process.env.MONGODB_URI
  if (!uri) {
    throw new Error('DATABASE_URI or MONGODB_URI environment variable required')
  }

  const client = new MongoClient(uri)

  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('static_assets')

    // Create partial unique index for single-active enforcement per (key, assetType)
    await collection.createIndex(
      { key: 1, assetType: 1 },
      {
        unique: true,
        partialFilterExpression: { status: 'active' },
        name: 'unique_active_per_key_assetType',
      },
    )

    console.log('Created partial unique index for single-active enforcement')

    // Create compound index for resolver queries
    await collection.createIndex(
      { key: 1, assetType: 1, status: 1 },
      { name: 'key_assetType_status_lookup' },
    )

    console.log('Created key_assetType_status lookup index')

    // Create unique index to prevent duplicate versions for same (key, assetType)
    // This prevents uploading two drafts with the same version
    //
    // MIGRATION NOTE: Before creating this index, check for existing duplicates:
    //   db.static_assets.aggregate([
    //     { $group: { _id: { key: "$key", assetType: "$assetType", version: "$version" }, count: { $sum: 1 } } },
    //     { $match: { count: { $gt: 1 } } }
    //   ])
    // If duplicates exist, resolve them manually before running this script.
    await collection.createIndex(
      { key: 1, assetType: 1, version: 1 },
      {
        unique: true,
        name: 'unique_key_assetType_version',
      },
    )

    console.log('Created unique key_assetType_version index')
  } finally {
    await client.close()
  }
}

createIndexes().catch(console.error)
```

### 2.5 Integration Tests for Stage 2

Create `tests/int/static-assets-activate.int.spec.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { StaticAsset, User } from '@/payload-types'

describe('StaticAssets Activation', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>
  let adminUser: User

  beforeAll(async () => {
    payload = await getPayload({ config })

    const users = await payload.find({
      collection: 'users',
      where: { role: { equals: 'admin' } },
      limit: 1,
    })

    if (users.docs.length > 0) {
      adminUser = users.docs[0] as User
    } else {
      adminUser = (await payload.create({
        collection: 'users',
        data: {
          email: 'test-admin@example.com',
          password: 'testpassword123',
          role: 'admin',
        },
      })) as User
    }
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'static-assets',
      where: { key: { contains: 'test-activation' } },
    })
  })

  it('should activate an asset and archive the previous one', async () => {
    const asset1 = await payload.create({
      collection: 'static-assets',
      data: {
        key: 'test-activation-asset',
        assetType: 'single',
        category: 'image',
        version: '1.0.0',
        status: 'draft',
      },
    })

    const { activateStaticAsset } = await import('@/lib/static-assets/activation')
    const result1 = await activateStaticAsset(payload, asset1.id, adminUser)

    expect(result1.success).toBe(true)
    expect(result1.asset?.status).toBe('active')

    const asset2 = await payload.create({
      collection: 'static-assets',
      data: {
        key: 'test-activation-asset',
        assetType: 'single',
        category: 'image',
        version: '2.0.0',
        status: 'draft',
      },
    })

    const result2 = await activateStaticAsset(payload, asset2.id, adminUser)

    expect(result2.success).toBe(true)
    expect(result2.asset?.status).toBe('active')
    expect(result2.previousAsset?.id).toBe(asset1.id)

    const archivedAsset = await payload.findByID({
      collection: 'static-assets',
      id: asset1.id,
    })

    expect(archivedAsset.status).toBe('archived')
  })

  it('should reject activating an already active asset (not idempotent by design)', async () => {
    const asset = await payload.create({
      collection: 'static-assets',
      data: {
        key: 'test-activation-already-active',
        assetType: 'single',
        category: 'image',
        version: '1.0.0',
        status: 'active',
      },
    })

    const { activateStaticAsset } = await import('@/lib/static-assets/activation')
    const result = await activateStaticAsset(payload, asset.id, adminUser)

    expect(result.success).toBe(false)
    expect(result.error).toContain('already active')
  })
})
```

---

## Stage 3: Bundle Support

### 3.1 Create `src/lib/static-assets/bundle-processor.ts`

```typescript
import JSZip from 'jszip'
import { put } from '@vercel/blob'
import { computeSha256 } from './checksum'
import { validateManifest, validateManifestPaths } from './validation'
import type { BundleManifest } from './types'
import { logger } from '@/utilities/logger'

export interface BundleProcessResult {
  success: true
  baseUrl: string
  manifest: BundleManifest
  checksumSha256: string
  fileCount: number
} | {
  success: false
  error: string
}

/**
 * Process an uploaded ZIP bundle
 *
 * 1. Extracts ZIP contents
 * 2. Reads and validates manifest.json
 * 3. Uploads all files to Vercel Blob under static-assets/<key>/<version>/
 * 4. Returns baseUrl and manifest (inline)
 */
export async function processBundleUpload(
  zipBuffer: Buffer,
  key: string,
  version: string,
): Promise<BundleProcessResult> {
  const processLogger = logger.child({ component: 'bundle-processor', key, version })

  try {
    processLogger.info({ zipSize: zipBuffer.length }, 'Starting bundle processing')

    // 1. Load ZIP
    const zip = await JSZip.loadAsync(zipBuffer)
    const files = Object.keys(zip.files)

    processLogger.debug({ fileCount: files.length }, 'ZIP loaded')

    // 2. Find and read manifest.json
    const manifestFile = zip.file('manifest.json')
    if (!manifestFile) {
      return { success: false, error: 'manifest.json not found in bundle' }
    }

    const manifestContent = await manifestFile.async('string')
    let manifestData: unknown

    try {
      manifestData = JSON.parse(manifestContent)
    } catch {
      return { success: false, error: 'Invalid JSON in manifest.json' }
    }

    // 3. Validate manifest
    const manifestValidation = validateManifest(manifestData)
    if (!manifestValidation.valid) {
      return { success: false, error: manifestValidation.error }
    }

    const manifest = manifestValidation.data

    const pathsValidation = validateManifestPaths(manifest)
    if (!pathsValidation.valid) {
      return { success: false, error: pathsValidation.error }
    }

    // 4. Verify all manifest paths exist in ZIP
    const requiredPaths = Object.values(manifest.paths).filter(Boolean) as string[]
    for (const path of requiredPaths) {
      if (!zip.file(path)) {
        return { success: false, error: `Manifest path not found in bundle: ${path}` }
      }
    }

    // 5. Upload all files to Vercel Blob and derive baseUrl from first upload
    const blobPrefix = `static-assets/${key}/${version}`
    let uploadedCount = 0
    let baseUrl = ''

    for (const filename of files) {
      const file = zip.file(filename)
      if (!file || file.dir) continue

      const content = await file.async('nodebuffer')
      const blobPath = `${blobPrefix}/${filename}`

      processLogger.debug({ filename, size: content.length }, 'Uploading file')

      const result = await put(blobPath, content, {
        access: 'public',
        addRandomSuffix: false,
      })

      // Derive baseUrl from the first successful upload's URL
      // result.url is like: https://xxx.public.blob.vercel-storage.com/static-assets/key/version/file.ext
      // We want: https://xxx.public.blob.vercel-storage.com/static-assets/key/version
      if (!baseUrl && result.url) {
        const prefixIndex = result.url.indexOf(blobPrefix)
        if (prefixIndex !== -1) {
          baseUrl = result.url.substring(0, prefixIndex + blobPrefix.length)
        }
      }

      uploadedCount++
    }

    // 6. Compute overall checksum
    const checksumSha256 = computeSha256(zipBuffer)

    processLogger.info(
      { uploadedCount, baseUrl, checksumSha256: checksumSha256.slice(0, 16) },
      'Bundle processing complete',
    )

    return {
      success: true,
      baseUrl,
      manifest,
      checksumSha256,
      fileCount: uploadedCount,
    }
  } catch (error) {
    processLogger.error({ error }, 'Bundle processing failed')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Validate that a file is a valid ZIP
 */
export async function isValidZip(buffer: Buffer): Promise<boolean> {
  try {
    await JSZip.loadAsync(buffer)
    return true
  } catch {
    return false
  }
}
```

### 3.2 Update Collection Hook for Bundle Processing

Add to `src/collections/StaticAssets.ts` beforeChange hooks:

```typescript
// Process ZIP bundles
async ({ data, req, operation }) => {
  if (operation === 'create' && data?.assetType === 'bundle' && req.file) {
    const { processBundleUpload, isValidZip } = await import(
      '@/lib/static-assets/bundle-processor'
    )

    if (!(await isValidZip(req.file.data))) {
      throw new Error('Bundle must be a valid ZIP file')
    }

    const result = await processBundleUpload(req.file.data, data.key, data.version)

    if (!result.success) {
      throw new Error(`Bundle processing failed: ${result.error}`)
    }

    // Set computed fields (v1: inline manifest only)
    data.baseUrl = result.baseUrl
    data.manifest = result.manifest
    data.checksumSha256 = result.checksumSha256
    data.contentType = 'application/zip'
    data.fileSize = req.file.data.length
  }
  return data
},
```

### 3.3 Seed Script for PDF.js Bundle

Create `scripts/seed-pdfjs-bundle.ts`:

```typescript
/**
 * Seed the initial PDF.js viewer bundle
 *
 * Run with: pnpm tsx scripts/seed-pdfjs-bundle.ts <path-to-bundle.zip> [--activate]
 */
import { getPayload } from 'payload'
import fs from 'fs'
import path from 'path'

async function seedPdfjsBundle() {
  const bundlePath = process.argv[2]
  if (!bundlePath) {
    console.error(
      'Usage: pnpm tsx scripts/seed-pdfjs-bundle.ts <path-to-pdfjs-bundle.zip> [--activate]',
    )
    process.exit(1)
  }

  const absolutePath = path.resolve(bundlePath)
  if (!fs.existsSync(absolutePath)) {
    console.error(`Bundle file not found: ${absolutePath}`)
    process.exit(1)
  }

  const payload = await getPayload({
    config: (await import('../src/payload.config')).default,
  })

  console.log('Creating PDF.js bundle static asset...')

  const zipBuffer = fs.readFileSync(absolutePath)

  const asset = await payload.create({
    collection: 'static-assets',
    data: {
      key: 'pdfjs-viewer',
      assetType: 'bundle',
      category: 'other',
      version: '4.4.168',
      status: 'draft',
    },
    file: {
      data: zipBuffer,
      mimetype: 'application/zip',
      name: 'pdfjs-bundle.zip',
      size: zipBuffer.length,
    },
  })

  console.log(`Created asset: ${asset.id}`)
  console.log(`Key: ${asset.key}`)
  console.log(`Version: ${asset.version}`)
  console.log(`Base URL: ${asset.baseUrl}`)

  if (process.argv.includes('--activate')) {
    const { activateStaticAsset } = await import('../src/lib/static-assets/activation')

    const admins = await payload.find({
      collection: 'users',
      where: { role: { equals: 'admin' } },
      limit: 1,
    })

    if (admins.docs.length === 0) {
      console.warn('No admin user found - skipping activation')
    } else {
      const result = await activateStaticAsset(payload, asset.id, admins.docs[0])
      if (result.success) {
        console.log('Asset activated successfully')
      } else {
        console.error(`Activation failed: ${result.error}`)
      }
    }
  }

  console.log('Done!')
  process.exit(0)
}

seedPdfjsBundle().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
```

---

## Stage 4: Resolver Layer

### 4.1 Create `src/lib/static-assets/resolver.ts`

```typescript
import type { Payload } from 'payload'
import type { StaticAsset } from '@/payload-types'
import type { ResolvedStaticAsset, ResolvedStaticBundle, BundleManifest } from './types'
import { validateManifest } from './validation'
import { logger } from '@/utilities/logger'

/**
 * Cache configuration
 */
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry<T> {
  data: T | null
  expires: number
}

const assetCache = new Map<string, CacheEntry<ResolvedStaticAsset>>()
const bundleCache = new Map<string, CacheEntry<ResolvedStaticBundle>>()

/**
 * Invalidate cache for a specific key
 */
export function invalidateCache(key: string): void {
  assetCache.delete(key)
  bundleCache.delete(key)
  logger.debug({ key }, 'Cache invalidated for static asset')
}

/**
 * Clear all caches (useful for testing)
 */
export function clearAllCaches(): void {
  assetCache.clear()
  bundleCache.clear()
}

/**
 * Validate and return manifest from document (v1: inline only)
 */
function resolveManifest(doc: StaticAsset): BundleManifest | null {
  if (!doc.manifest) {
    logger.error({ key: doc.key, id: doc.id }, 'Bundle has no manifest')
    return null
  }

  const validation = validateManifest(doc.manifest)
  if (!validation.valid) {
    logger.error({ key: doc.key, error: validation.error }, 'Invalid manifest')
    return null
  }

  return validation.data
}

/**
 * Get the active static asset for a given key (single files only)
 */
export async function getActiveStaticAsset(
  key: string,
  payload: Payload,
  options: { skipCache?: boolean } = {},
): Promise<ResolvedStaticAsset | null> {
  const cacheKey = key

  if (!options.skipCache) {
    const cached = assetCache.get(cacheKey)
    if (cached && cached.expires > Date.now()) {
      logger.debug({ key, source: 'cache' }, 'Returning cached static asset')
      return cached.data
    }
  }

  const result = await payload.find({
    collection: 'static-assets',
    where: {
      and: [
        { key: { equals: key } },
        { assetType: { equals: 'single' } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
  })

  if (result.docs.length === 0) {
    assetCache.set(cacheKey, { data: null, expires: Date.now() + CACHE_TTL_MS })
    logger.debug({ key }, 'No active static asset found')
    return null
  }

  const doc = result.docs[0] as StaticAsset

  const resolved: ResolvedStaticAsset = {
    id: doc.id,
    key: doc.key,
    assetType: 'single',
    category: doc.category,
    version: doc.version,
    publicUrl: doc.publicUrl || doc.url || '',
    contentType: doc.contentType || '',
    checksumSha256: doc.checksumSha256 || '',
  }

  assetCache.set(cacheKey, { data: resolved, expires: Date.now() + CACHE_TTL_MS })
  logger.debug({ key, version: resolved.version }, 'Resolved and cached static asset')

  return resolved
}

/**
 * Get the active static bundle for a given key
 */
export async function getActiveStaticBundle(
  key: string,
  payload: Payload,
  options: { skipCache?: boolean } = {},
): Promise<ResolvedStaticBundle | null> {
  const cacheKey = key

  if (!options.skipCache) {
    const cached = bundleCache.get(cacheKey)
    if (cached && cached.expires > Date.now()) {
      logger.debug({ key, source: 'cache' }, 'Returning cached static bundle')
      return cached.data
    }
  }

  const result = await payload.find({
    collection: 'static-assets',
    where: {
      and: [
        { key: { equals: key } },
        { assetType: { equals: 'bundle' } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
  })

  if (result.docs.length === 0) {
    bundleCache.set(cacheKey, { data: null, expires: Date.now() + CACHE_TTL_MS })
    logger.debug({ key }, 'No active static bundle found')
    return null
  }

  const doc = result.docs[0] as StaticAsset

  // Validate inline manifest
  const manifest = resolveManifest(doc)
  if (!manifest) {
    bundleCache.set(cacheKey, { data: null, expires: Date.now() + CACHE_TTL_MS })
    return null
  }

  const resolved: ResolvedStaticBundle = {
    id: doc.id,
    key: doc.key,
    assetType: 'bundle',
    category: doc.category,
    version: doc.version,
    baseUrl: doc.baseUrl || '',
    contentType: doc.contentType || '',
    checksumSha256: doc.checksumSha256 || '',
    manifest,
  }

  bundleCache.set(cacheKey, { data: resolved, expires: Date.now() + CACHE_TTL_MS })
  logger.debug({ key, version: resolved.version }, 'Resolved and cached static bundle')

  return resolved
}
```

### 4.2 Unit Tests for Resolver

Create `tests/unit/resolver.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Static Assets Resolver', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('cache behavior', () => {
    it('returns cached result within TTL', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [
            {
              id: '1',
              key: 'test-asset',
              assetType: 'single',
              category: 'image',
              version: '1.0',
              publicUrl: 'https://example.com/test.png',
              contentType: 'image/png',
              checksumSha256: 'abc123',
            },
          ],
        }),
      }

      const { getActiveStaticAsset, clearAllCaches } = await import('@/lib/static-assets/resolver')
      clearAllCaches()

      const result1 = await getActiveStaticAsset('test-asset', mockPayload as any)
      expect(result1).not.toBeNull()
      expect(mockPayload.find).toHaveBeenCalledTimes(1)

      const result2 = await getActiveStaticAsset('test-asset', mockPayload as any)
      expect(result2).toEqual(result1)
      expect(mockPayload.find).toHaveBeenCalledTimes(1) // Still 1, used cache
    })

    it('invalidates cache on key update', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [
            {
              id: '1',
              key: 'test-asset',
              assetType: 'single',
              category: 'image',
              version: '1.0',
              publicUrl: 'https://example.com/test.png',
              contentType: 'image/png',
              checksumSha256: 'abc123',
            },
          ],
        }),
      }

      const { getActiveStaticAsset, invalidateCache, clearAllCaches } =
        await import('@/lib/static-assets/resolver')
      clearAllCaches()

      await getActiveStaticAsset('test-asset', mockPayload as any)
      expect(mockPayload.find).toHaveBeenCalledTimes(1)

      invalidateCache('test-asset')

      await getActiveStaticAsset('test-asset', mockPayload as any)
      expect(mockPayload.find).toHaveBeenCalledTimes(2)
    })
  })

  describe('getActiveStaticBundle', () => {
    it('returns null when bundle has no manifest', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [
            {
              id: '1',
              key: 'test-bundle',
              assetType: 'bundle',
              category: 'other',
              version: '1.0',
              baseUrl: 'https://example.com/bundle',
              contentType: 'application/zip',
              checksumSha256: 'abc123',
              manifest: null,
            },
          ],
        }),
      }

      const { getActiveStaticBundle, clearAllCaches } = await import('@/lib/static-assets/resolver')
      clearAllCaches()

      const result = await getActiveStaticBundle('test-bundle', mockPayload as any)
      expect(result).toBeNull()
    })

    it('returns resolved bundle with valid manifest', async () => {
      const mockPayload = {
        find: vi.fn().mockResolvedValue({
          docs: [
            {
              id: '1',
              key: 'pdfjs-viewer',
              assetType: 'bundle',
              category: 'other',
              version: '4.4.168',
              baseUrl: 'https://example.com/static-assets/pdfjs-viewer/4.4.168',
              contentType: 'application/zip',
              checksumSha256: 'abc123',
              manifest: {
                version: '4.4.168',
                paths: {
                  viewerHtml: 'web/viewer.html',
                  viewerMjs: 'web/viewer.mjs',
                  viewerCss: 'web/viewer.css',
                  pdfMjs: 'build/pdf.mjs',
                },
              },
            },
          ],
        }),
      }

      const { getActiveStaticBundle, clearAllCaches } = await import('@/lib/static-assets/resolver')
      clearAllCaches()

      const result = await getActiveStaticBundle('pdfjs-viewer', mockPayload as any)

      expect(result).not.toBeNull()
      expect(result?.assetType).toBe('bundle')
      expect(result?.version).toBe('4.4.168')
      expect(result?.manifest.paths.viewerHtml).toBe('web/viewer.html')
    })
  })
})
```

---

## Stage 5: PDF Viewer Route Refactor

### 5.1 Overview

Refactor `/api/pdfjs-viewer` to load all assets via the StaticAssets resolver, removing hardcoded CDN URLs and hashes.

**Current State** (to be removed):

- `src/lib/pdfjs/config.ts` contains hardcoded `PDFJS_VERSION`, `CDN_BASE`, `VIEWER_URLS`
- Route builds URLs using these constants

**Target State**:

- Route calls `getActiveStaticBundle('pdfjs-viewer')`
- Redirect to bundle's `viewer.html` with `?file=` query param (no inline scripts)
- `config.ts` reduced to non-URL configuration only

**Key Principle**: No inline script injection. PDF.js viewer natively supports `?file=` parameter.

### 5.2 Update Route to Use Resolver (Redirect Approach)

The simplest and most secure approach: redirect to the bundle's viewer.html with the file param.

Update `src/app/api/pdfjs-viewer/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getActiveStaticBundle } from '@/lib/static-assets/resolver'
import { validateFileUrl } from '@/lib/pdfjs/validator'
import { logger } from '@/utilities/logger'

export async function GET(request: Request) {
  const routeLogger = logger.child({ component: 'pdfjs-viewer-route' })

  // 1. Validate file parameter (existing security logic)
  const { searchParams } = new URL(request.url)
  const fileUrl = searchParams.get('file')

  const validation = validateFileUrl(fileUrl)
  if (!validation.valid) {
    routeLogger.warn({ reason: validation.error }, 'Invalid file URL')
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // 2. Get active PDF.js bundle via resolver
  const payload = await getPayload({ config })
  const bundle = await getActiveStaticBundle('pdfjs-viewer', payload)

  if (!bundle) {
    routeLogger.error('No active pdfjs-viewer bundle found')
    return NextResponse.json({ error: 'PDF viewer not available' }, { status: 503 })
  }

  routeLogger.debug(
    { version: bundle.version, baseUrl: bundle.baseUrl },
    'Resolved pdfjs-viewer bundle',
  )

  // 3. Build viewer URL with file param (PDF.js native support)
  const { baseUrl, manifest } = bundle
  const viewerHtmlPath = manifest.paths.viewerHtml
  const viewerUrl = `${baseUrl}/${viewerHtmlPath}?file=${encodeURIComponent(validation.url)}`

  // 4. Redirect to the bundle's viewer.html
  // This avoids any inline script injection and uses PDF.js native ?file= support
  return NextResponse.redirect(viewerUrl, {
    status: 302,
    headers: {
      'Cache-Control': 'private, no-cache',
    },
  })
}
```

### 5.3 Clean Up Hardcoded Config

Update `src/lib/pdfjs/config.ts`:

```typescript
/**
 * PDF.js Viewer Configuration
 *
 * NOTE: CDN URLs and version are now managed via StaticAssets.
 * Use getActiveStaticBundle('pdfjs-viewer') to resolve URLs.
 *
 * This file contains only non-URL configuration.
 */

// Cache configuration for template/CSS fetching
export const CACHE_CONFIG = {
  revalidateSeconds: 3600, // 1 hour
}

// Security: Allowed origins for file parameter
export const ALLOWED_FILE_ORIGINS = [
  // Same-origin is always allowed
  // Add additional allowed origins here if needed
] as const
```

### 5.4 Unit Tests for Route Logic

Test the route handler directly without network calls:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@/lib/static-assets/resolver', () => ({
  getActiveStaticBundle: vi.fn(),
}))

describe('PDF.js Viewer Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid file URL', async () => {
    const { GET } = await import('@/app/api/pdfjs-viewer/route')
    const request = new NextRequest('http://localhost/api/pdfjs-viewer?file=javascript:alert(1)')

    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it('returns 503 when no active bundle exists', async () => {
    const { getActiveStaticBundle } = await import('@/lib/static-assets/resolver')
    vi.mocked(getActiveStaticBundle).mockResolvedValue(null)

    const { GET } = await import('@/app/api/pdfjs-viewer/route')
    const request = new NextRequest('http://localhost/api/pdfjs-viewer?file=/test.pdf')

    const response = await GET(request)

    expect(response.status).toBe(503)
  })

  it('redirects to bundle viewer with file param', async () => {
    const { getActiveStaticBundle } = await import('@/lib/static-assets/resolver')
    vi.mocked(getActiveStaticBundle).mockResolvedValue({
      id: 'test-id',
      key: 'pdfjs-viewer',
      assetType: 'bundle',
      category: 'other',
      version: '4.4.168',
      baseUrl: 'https://cdn.example.com/static-assets/pdfjs-viewer/4.4.168',
      contentType: 'application/zip',
      checksumSha256: 'abc123',
      manifest: {
        version: '4.4.168',
        paths: {
          viewerHtml: 'web/viewer.html',
          viewerMjs: 'web/viewer.mjs',
          viewerCss: 'web/viewer.css',
          pdfMjs: 'build/pdf.mjs',
        },
      },
    })

    const { GET } = await import('@/app/api/pdfjs-viewer/route')
    const request = new NextRequest('http://localhost/api/pdfjs-viewer?file=/media/test.pdf')

    const response = await GET(request)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toContain('https://cdn.example.com')
    expect(response.headers.get('Location')).toContain('file=%2Fmedia%2Ftest.pdf')
  })
})
```

---

## Test Strategy

### Unit Tests Summary

| File                               | Tests                                                   |
| ---------------------------------- | ------------------------------------------------------- |
| `static-assets-validation.spec.ts` | Key validation, version validation, manifest validation |
| `static-assets-checksum.spec.ts`   | SHA-256 computation, SRI hash generation                |
| `bundle-processor.spec.ts`         | ZIP validation, manifest extraction, path validation    |
| `resolver.spec.ts`                 | Cache behavior, TTL, invalidation, manifest validation  |

### Integration Tests Summary

| File                                   | Tests                                                   |
| -------------------------------------- | ------------------------------------------------------- |
| `static-assets-collection.int.spec.ts` | CRUD operations, hook execution                         |
| `static-assets-activate.int.spec.ts`   | Activation workflow, single-active per (key, assetType) |

**Note**: Stage 5 route tests are **unit tests** (see 5.4) using `NextRequest` with mocked dependencies—NOT integration tests with HTTP fetch. This avoids needing a running server and makes tests faster and more reliable.

### Manual Smoke Tests

1. **Upload & Activate Single Asset**
   - Upload PNG via admin panel
   - Verify computed fields populated (checksum, contentType)
   - Activate via endpoint
   - Verify status change and audit fields

2. **Upload & Activate Bundle**
   - Create PDF.js bundle ZIP with manifest
   - Upload via admin panel with assetType=bundle
   - Verify bundle extraction (baseUrl, manifest)
   - Activate bundle
   - Verify resolver returns correct manifest

3. **Version Switch Without Redeploy**
   - Upload new bundle version
   - Activate new version
   - Verify previous version archived
   - Verify resolver returns new version
   - Rollback by activating previous version

4. **PDF Viewer Route Integration** (Stage 5)
   - Access `/api/pdfjs-viewer?file=/media/test.pdf`
   - Verify HTML response contains URLs from active bundle
   - Verify no hardcoded CDN URLs in response
   - Switch to different bundle version → verify route uses new version

---

## Migration & Seeding

### Initial Setup Checklist

1. [ ] Run `pnpm generate:types` after adding collection
2. [ ] Run MongoDB index creation script
3. [ ] Create PDF.js bundle ZIP with manifest
4. [ ] Run seed script to create initial bundle
5. [ ] Activate initial bundle

### PDF.js Bundle Structure

```
pdfjs-bundle-4.4.168.zip
├── manifest.json
├── web/
│   ├── viewer.html
│   ├── viewer.mjs
│   ├── viewer.css
│   └── images/
│       └── *.svg
└── build/
    ├── pdf.mjs
    └── pdf.worker.mjs
```

### manifest.json Example

```json
{
  "version": "4.4.168",
  "paths": {
    "viewerHtml": "web/viewer.html",
    "viewerMjs": "web/viewer.mjs",
    "viewerCss": "web/viewer.css",
    "pdfMjs": "build/pdf.mjs",
    "workerMjs": "build/pdf.worker.mjs",
    "webBase": "web"
  }
}
```

---

## Future Consumer Guide

For future consumers of StaticAssets (other than pdfjs-viewer which is implemented in Stage 5):

```typescript
import { getActiveStaticAsset, getActiveStaticBundle } from '@/lib/static-assets/resolver'

// For single files
const asset = await getActiveStaticAsset('logo-svg', payload)
if (asset) {
  console.log(asset.publicUrl) // Use this URL
}

// For bundles
const bundle = await getActiveStaticBundle('my-bundle', payload)
if (bundle) {
  const fileUrl = `${bundle.baseUrl}/${bundle.manifest.paths.someFile}`
}
```

**Consumer Rules:**

- Always use resolver (never hardcode paths)
- Always check for null (bundle may not be active)
- Never infer structure without manifest
- Handle 503 gracefully for missing bundles

---

## Dependencies

### No New Runtime Dependencies

All functionality uses existing packages:

- Payload CMS (collections, hooks, endpoints)
- `@vercel/blob` (already configured)
- `zod` (already used for validation)
- Node.js `crypto` (built-in)

### Optional Development Dependency

For ZIP processing in Stage 3 (runtime dependency, used in bundle-processor):

```bash
pnpm add jszip
```

---

## Security Checklist

- [x] Admin-only upload and activation
- [x] Key validation (no path traversal)
- [x] Version validation (no path traversal)
- [x] Manifest validation (inline JSON, strict schema)
- [x] Cache invalidation on updates
- [x] Single-active enforcement via DB index per (key, assetType)
- [x] Hard fail on missing/invalid manifest (no guessing)
- [x] SRI hashes stored for integrity verification
- [x] No inline script injection (use PDF.js native `?file=` param)

---

## Guardrails Summary

| Rule                       | Enforcement                                                          |
| -------------------------- | -------------------------------------------------------------------- |
| Admin-only upload/activate | Access control + endpoint auth                                       |
| Deterministic resolution   | Hard fail if manifest missing/invalid (no guessing)                  |
| Easy rollback              | Activate any previous version without redeploy                       |
| No CSP weakening           | No new inline scripts in assets                                      |
| Single source of truth     | One collection, explicit `assetType` field                           |
| No hardcoded paths         | All runtime code uses resolver only                                  |
| Strict file validation     | `validateFileUrl()` allowlist, reject dangerous schemes              |
| Activation rule            | Only one `active` per `(key, assetType)`                             |
| Version uniqueness         | Only one version per `(key, assetType, version)` via DB unique index |

---

## Out of Scope (v2)

The following features are deferred to v2:

1. **manifestPath in Blob** (Option B)
   - v1 uses inline manifest only
   - v2 could add `manifestPath` field and fetch manifest from Blob as fallback

2. **Runtime JS/CSS auto-loading**
   - Global config for allowed runtime assets
   - SRI integrity verification
   - CSP updates for script-src/style-src
   - Note: CSS/JS can still be uploaded as file types in v1, just not auto-loaded

3. **Directory tree upload**
   - v1 requires ZIP bundles
   - v2 could support uploading directory trees directly
