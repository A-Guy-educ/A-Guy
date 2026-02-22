// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * @fileType unit-test
 * @domain admin, exercise-conversion
 * @pattern error-handling, console-logging
 * @ai-summary Tests for ConvertForm error logging in catch block
 */

import { ConvertForm } from '@/ui/admin/exercise-conversion/ConvertForm'

describe('ConvertForm', () => {
  const defaultProps = {
    lessonId: 'lesson-123',
    mediaId: 'media-456',
    filename: 'test-image.png',
    onClose: vi.fn(),
  }

  const mockPromptsResponse = {
    extractors: [
      { id: 'ext-1', title: 'Extractor 1', key: 'ext1', type: 'extractor', usage: 'test' },
    ],
    verifiers: [{ id: 'ver-1', title: 'Verifier 1', key: 'ver1', type: 'verifier', usage: 'test' }],
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock fetch for prompt loading (success)
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockPromptsResponse,
    })
  })

  afterEach(() => {
    cleanup()
  })

  describe('error logging', () => {
    it('logs error to console when queue submission throws', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const testError = new Error('Network error: failed to connect')

      // Mock fetch for prompt loading (success)
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPromptsResponse,
        })
        // Mock the queue submission to throw an error
        .mockRejectedValueOnce(testError)

      render(<ConvertForm {...defaultProps} />)

      // Wait for prompts to load
      await waitFor(() => {
        expect(screen.getByText('Select Extractor...')).toBeTruthy()
      })

      // Select options to enable the submit button
      const selects = screen.getAllByRole('combobox')
      const extractorSelect = selects[0]
      const verifierSelect = selects[1]

      // Select extractor and verifier
      fireEvent.change(extractorSelect, { target: { value: 'ext-1' } })
      fireEvent.change(verifierSelect, { target: { value: 'ver-1' } })

      // Click the Convert button
      const convertButton = screen.getByRole('button', { name: 'Convert' })
      fireEvent.click(convertButton)

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Queue failed')).toBeTruthy()
      })

      // Assert console.error was called with the correct prefix and error
      expect(consoleErrorSpy).toHaveBeenCalledWith('Exercise conversion queue failed:', testError)

      // Assert the error message is still visible in the UI (no regression)
      expect(screen.getByText('Queue failed')).toBeTruthy()

      consoleErrorSpy.mockRestore()
    })

    it('displays Queue failed error message when submission fails', async () => {
      // Mock fetch to succeed for prompts and fail for submission
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPromptsResponse,
        })
        .mockRejectedValueOnce(new Error('API unavailable'))

      render(<ConvertForm {...defaultProps} />)

      // Wait for prompts to load
      await waitFor(() => {
        expect(screen.getByText('Select Extractor...')).toBeTruthy()
      })

      // Select options to enable the submit button
      const selects = screen.getAllByRole('combobox')
      fireEvent.change(selects[0], { target: { value: 'ext-1' } })
      fireEvent.change(selects[1], { target: { value: 'ver-1' } })

      // Click the Convert button
      const convertButton = screen.getByRole('button', { name: 'Convert' })
      fireEvent.click(convertButton)

      // Assert error message is displayed
      await waitFor(() => {
        expect(screen.getByText('Queue failed')).toBeTruthy()
      })
    })
  })
})
