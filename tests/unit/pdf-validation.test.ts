import { describe, it, expect } from 'vitest'
import { PDF_MAX_BYTES } from '@/server/config/constants'
import { mapProxyErrorToStage } from '@/server/services/pdf-fetcher'

// PDF validation pure functions

function isPdfMime(mime: string): boolean {
  return mime === 'application/pdf'
}

function hasPdfMagicBytes(buf: Buffer): boolean {
  if (buf.length < 4) return false
  return buf.slice(0, 4).toString('ascii') === '%PDF'
}

function isPdfSizeAllowed(size: number, maxBytes: number): boolean {
  return size <= maxBytes
}

const _PROXY_TO_STAGE: Record<string, string> = {
  MEDIA_NOT_FOUND: 'MEDIA_NOT_FOUND',
  NOT_PDF: 'NOT_PDF',
  INVALID_PDF: 'INVALID_PDF',
  PDF_TOO_LARGE: 'PDF_TOO_LARGE',
  UNAUTHORIZED: 'MEDIA_ACCESS_DENIED',
  FETCH_FAILED: 'MEDIA_FETCH_FAILED',
  INTERNAL_ERROR: 'MEDIA_FETCH_FAILED',
}

describe('PDF Validation Helpers', () => {
  describe('isPdfMime', () => {
    it('accepts application/pdf', () => {
      expect(isPdfMime('application/pdf')).toBe(true)
    })

    it('rejects text/plain', () => {
      expect(isPdfMime('text/plain')).toBe(false)
    })

    it('rejects empty string', () => {
      expect(isPdfMime('')).toBe(false)
    })
  })

  describe('hasPdfMagicBytes', () => {
    it('accepts valid PDF header', () => {
      expect(hasPdfMagicBytes(Buffer.from('%PDF-1.4'))).toBe(true)
    })

    it('rejects non-PDF content', () => {
      expect(hasPdfMagicBytes(Buffer.from('NOTPDF-1.4'))).toBe(false)
    })

    it('rejects short buffer (less than 4 bytes)', () => {
      expect(hasPdfMagicBytes(Buffer.from('%PD'))).toBe(false)
    })
  })

  describe('isPdfSizeAllowed', () => {
    it('accepts size at limit', () => {
      expect(isPdfSizeAllowed(PDF_MAX_BYTES, PDF_MAX_BYTES)).toBe(true)
    })

    it('accepts size below limit', () => {
      expect(isPdfSizeAllowed(1024, PDF_MAX_BYTES)).toBe(true)
    })

    it('rejects size above limit', () => {
      expect(isPdfSizeAllowed(PDF_MAX_BYTES + 1, PDF_MAX_BYTES)).toBe(false)
    })
  })

  describe('PROXY_TO_STAGE mapping', () => {
    it('maps MEDIA_NOT_FOUND correctly', () => {
      expect(mapProxyErrorToStage('MEDIA_NOT_FOUND')).toBe('MEDIA_NOT_FOUND')
    })

    it('maps NOT_PDF correctly', () => {
      expect(mapProxyErrorToStage('NOT_PDF')).toBe('NOT_PDF')
    })

    it('maps UNAUTHORIZED to MEDIA_ACCESS_DENIED', () => {
      expect(mapProxyErrorToStage('UNAUTHORIZED')).toBe('MEDIA_ACCESS_DENIED')
    })

    it('maps unknown to MEDIA_FETCH_FAILED', () => {
      expect(mapProxyErrorToStage('UNKNOWN_CODE')).toBe('MEDIA_FETCH_FAILED')
    })
  })
})
