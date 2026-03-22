// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * @fileType unit-test
 * @domain admin, exercise-conversion
 * @pattern button-component, prompt-selection
 * @ai-summary Tests for ConvertV3Button component with prompt selection
 */

import { ConvertV3Button } from '@/ui/admin/exercise-conversion/ConvertV3Button'

describe('ConvertV3Button', () => {
  const defaultProps = {
    lessonId: 'lesson-123',
    mediaId: 'media-456',
  }

  const mockPromptsResponse = {
    extractors: [
      { id: 'ext-1', title: 'Extractor 1', promptKey: 'ext1', usage: 'extractor' },
      { id: 'ext-2', title: 'Extractor 2', promptKey: 'ext2', usage: 'extractor' },
    ],
    verifiers: [{ id: 'ver-1', title: 'Verifier 1', promptKey: 'ver1', usage: 'verifier' }],
  }

  const mockConvertSuccessResponse = {
    success: true,
    data: {
      exerciseId: 'ex-123',
      adminUrl: '/admin/exercises/ex-123',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows collapsed "Convert V3" button by default', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPromptsResponse,
    })

    render(<ConvertV3Button {...defaultProps} />)

    expect(screen.getByRole('button', { name: 'Convert V3' })).toBeTruthy()
  })

  it('expands to show prompt dropdown when clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPromptsResponse,
    })

    render(<ConvertV3Button {...defaultProps} />)

    // Click the collapsed button to expand
    fireEvent.click(screen.getByRole('button', { name: 'Convert V3' }))

    // Should show the dropdown
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeTruthy()
    })

    // Should show Convert and Cancel buttons
    expect(screen.getByRole('button', { name: 'Convert' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('shows loading state while fetching prompts', async () => {
    // Mock fetch that never resolves immediately to keep loading state
    let resolvePrompt: (value: unknown) => void
    const fetchPromise = new Promise((resolve) => {
      resolvePrompt = resolve
    })
    global.fetch = vi.fn().mockReturnValue(fetchPromise)

    render(<ConvertV3Button {...defaultProps} />)

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: 'Convert V3' }))

    // Should show loading
    expect(screen.getByText('Loading prompts...')).toBeTruthy()

    // Resolve the fetch
    await act(async () => {
      resolvePrompt!({
        ok: true,
        json: async () => mockPromptsResponse,
      })
    })
  })

  it('shows prompt options in dropdown', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPromptsResponse,
    })

    render(<ConvertV3Button {...defaultProps} />)

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: 'Convert V3' }))

    // Wait for prompts to load
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeTruthy()
    })

    // Check dropdown options
    const select = screen.getByRole('combobox')
    const options = select.querySelectorAll('option')

    // Should have: default option + 2 extractors
    expect(options.length).toBe(3)
    expect(options[0].textContent).toBe('Default prompt')
    expect(options[1].textContent).toBe('Extractor 1')
    expect(options[2].textContent).toBe('Extractor 2')
  })

  it('excludes verifier prompts from dropdown options', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPromptsResponse,
    })

    render(<ConvertV3Button {...defaultProps} />)

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: 'Convert V3' }))

    // Wait for prompts to load
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeTruthy()
    })

    // Check that verifier is not in options
    const select = screen.getByRole('combobox')
    const options = select.querySelectorAll('option')
    const optionTexts = Array.from(options).map((opt) => opt.textContent)

    expect(optionTexts).not.toContain('Verifier 1')
  })

  it('sends promptId to endpoint when prompt is selected', async () => {
    let callCount = 0
    const fetchMock = vi.fn().mockImplementation((url: unknown) => {
      if (callCount === 0) {
        callCount++
        return Promise.resolve({
          ok: true,
          json: async () => mockPromptsResponse,
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockConvertSuccessResponse,
      })
    })
    global.fetch = fetchMock

    render(<ConvertV3Button {...defaultProps} />)

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: 'Convert V3' }))

    // Wait for prompts to load
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeTruthy()
    })

    // Select "Extractor 1"
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'ext-1' } })

    // Click Convert
    fireEvent.click(screen.getByRole('button', { name: 'Convert' }))

    // Wait for conversion to complete
    await waitFor(() => {
      expect(screen.getByText(/View exercise/)).toBeTruthy()
    })

    // Verify the convert endpoint was called with promptId
    const calls = fetchMock.mock.calls
    const convertCall = calls.find(
      (call: unknown[]) => (call[0] as string) === '/api/exercises/convert/single',
    )
    expect(convertCall).toBeTruthy()

    const requestBody = JSON.parse(convertCall![1].body)
    expect(requestBody.promptId).toBe('ext-1')
    expect(requestBody.lessonId).toBe('lesson-123')
    expect(requestBody.mediaId).toBe('media-456')
  })

  it('omits promptId from request when default is selected', async () => {
    let callCount = 0
    const fetchMock = vi.fn().mockImplementation((url: unknown) => {
      if (callCount === 0) {
        callCount++
        return Promise.resolve({
          ok: true,
          json: async () => mockPromptsResponse,
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockConvertSuccessResponse,
      })
    })
    global.fetch = fetchMock

    render(<ConvertV3Button {...defaultProps} />)

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: 'Convert V3' }))

    // Wait for prompts to load
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeTruthy()
    })

    // Leave dropdown on default (empty value)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('')

    // Click Convert
    fireEvent.click(screen.getByRole('button', { name: 'Convert' }))

    // Wait for conversion
    await waitFor(() => {
      expect(screen.getByText(/View exercise/)).toBeTruthy()
    })

    // Verify promptId is NOT in the request body
    const calls = fetchMock.mock.calls
    const convertCall = calls.find(
      (call: unknown[]) => (call[0] as string) === '/api/exercises/convert/single',
    )
    expect(convertCall).toBeTruthy()

    const requestBody = JSON.parse(convertCall![1].body)
    expect(requestBody.promptId).toBeUndefined()
    expect(requestBody.lessonId).toBe('lesson-123')
    expect(requestBody.mediaId).toBe('media-456')
  })

  it('shows error state when prompts fail to load', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    render(<ConvertV3Button {...defaultProps} />)

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: 'Convert V3' }))

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Failed to load prompts')).toBeTruthy()
    })

    // Should show retry button
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('retry loads prompts after error', async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPromptsResponse,
      })
    global.fetch = fetchSpy

    render(<ConvertV3Button {...defaultProps} />)

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: 'Convert V3' }))

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText('Failed to load prompts')).toBeTruthy()
    })

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    // Wait for prompts to load
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeTruthy()
    })

    // Verify retry fetch was called
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('cancel button collapses back to button state', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPromptsResponse,
    })

    render(<ConvertV3Button {...defaultProps} />)

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: 'Convert V3' }))

    // Wait for dropdown
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeTruthy()
    })

    // Click Cancel
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    // Should be collapsed again
    expect(screen.getByRole('button', { name: 'Convert V3' })).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('shows success message with exercise link after conversion', async () => {
    let callCount = 0
    const fetchMock = vi.fn().mockImplementation((url: unknown) => {
      if (callCount === 0) {
        callCount++
        return Promise.resolve({
          ok: true,
          json: async () => mockPromptsResponse,
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockConvertSuccessResponse,
      })
    })
    global.fetch = fetchMock

    render(<ConvertV3Button {...defaultProps} />)

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: 'Convert V3' }))

    // Wait for prompts
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeTruthy()
    })

    // Select a prompt
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'ext-1' } })

    // Click Convert
    fireEvent.click(screen.getByRole('button', { name: 'Convert' }))

    // Should show success message with link
    await waitFor(() => {
      expect(screen.getByText('Exercise created successfully!')).toBeTruthy()
      const link = screen.getByRole('link', { name: 'View exercise' })
      expect(link.getAttribute('href')).toBe('/admin/exercises/ex-123')
    })
  })

  it('shows error message when conversion fails', async () => {
    let callCount = 0
    const fetchMock = vi.fn().mockImplementation((url: unknown) => {
      if (callCount === 0) {
        callCount++
        return Promise.resolve({
          ok: true,
          json: async () => mockPromptsResponse,
        })
      }
      return Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Conversion failed' }),
      })
    })
    global.fetch = fetchMock

    render(<ConvertV3Button {...defaultProps} />)

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: 'Convert V3' }))

    // Wait for prompts
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeTruthy()
    })

    // Select a prompt
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'ext-1' } })

    // Click Convert
    fireEvent.click(screen.getByRole('button', { name: 'Convert' }))

    // Should show error
    await waitFor(() => {
      expect(screen.getByText('Conversion failed')).toBeTruthy()
    })
  })
})

// Helper for act wrapper
async function act<T>(fn: () => Promise<T>): Promise<T> {
  return fn()
}
