/**
 * Unit tests for Issue #2545: Admin PDF conversion route renders blank
 *
 * The admin PDF conversion page at /admin/pdf-conversion should display
 * the PDF conversion interface (ConversionForm, JobHistory) when logged
 * in as an admin. This test verifies that the page renders correctly.
 *
 * Bug: Page renders blank instead of showing PDF conversion interface
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import React from 'react'

// Mock requestAnimationFrame
const mockRequestAnimationFrame = vi.fn((cb: (time: number) => void) => {
  cb(0)
  return 0
})
global.requestAnimationFrame = mockRequestAnimationFrame
global.cancelAnimationFrame = vi.fn()

// Mock logger
vi.mock('@/infra/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}))

// Mock useCurrentUser hook
vi.mock('@/client/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'test-user-id', email: 'test@example.com', role: 'admin' } as any,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

describe('Issue #2545: Admin PDF conversion page renders blank', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequestAnimationFrame.mockImplementation((cb: (time: number) => void) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Admin PDF Conversion Page Rendering', () => {
    it('should render PDF conversion page with header when admin is logged in', async () => {
      const AdminPdfConversionPage = (await import('@/app/(payload)/admin/pdf-conversion/page'))
        .default
      const { container } = render(<AdminPdfConversionPage />)

      // Wait for the page to finish loading
      await waitFor(
        () => {
          // Should show the PDF Conversion title
          expect(container.textContent).toContain('PDF Conversion')
        },
        { timeout: 5000 },
      )
    })

    it('should render JobHistory section when admin is logged in', async () => {
      const AdminPdfConversionPage = (await import('@/app/(payload)/admin/pdf-conversion/page'))
        .default
      const { container } = render(<AdminPdfConversionPage />)

      await waitFor(
        () => {
          // Should show Job History section
          expect(container.textContent).toContain('Job History')
        },
        { timeout: 5000 },
      )
    })

    it('should render ConversionForm section when admin is logged in', async () => {
      const AdminPdfConversionPage = (await import('@/app/(payload)/admin/pdf-conversion/page'))
        .default
      const { container } = render(<AdminPdfConversionPage />)

      await waitFor(
        () => {
          // Should show the Convert PDF to Exercises heading
          expect(container.textContent).toContain('Convert PDF to Exercises')
        },
        { timeout: 5000 },
      )
    })
  })
})
