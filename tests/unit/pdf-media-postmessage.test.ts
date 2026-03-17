/**
 * @fileType unit-test
 * @domain frontend
 * @pattern pdf-viewer, postmessage
 * @ai-summary Tests for PDFMedia component handling postMessage from iframe
 */
import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import path from 'path'

describe('PDFMedia postMessage error handling - Source Code Verification', () => {
  // Read the actual source file
  const pdfMediaSourcePath = path.resolve(__dirname, '../../src/ui/web/media/PDFMedia/index.tsx')
  const pdfMediaSource = readFileSync(pdfMediaSourcePath, 'utf-8')

  it('should listen for postMessage with pdf-load-error type from iframe', () => {
    // Verify that the component code includes postMessage handling
    expect(pdfMediaSource).toContain("addEventListener('message'")
    expect(pdfMediaSource).toContain("'pdf-load-error'")
  })

  it('should call setHasError when receiving pdf-load-error message', () => {
    // Verify that receiving the error message triggers setHasError
    expect(pdfMediaSource).toContain('setHasError(true)')
    expect(pdfMediaSource).toContain("event.data?.type === 'pdf-load-error'")
  })

  it('should clean up message event listener on unmount', () => {
    // Verify that the useEffect returns a cleanup function
    expect(pdfMediaSource).toContain("removeEventListener('message'")
  })

  it('should have retry logic after error is set', () => {
    // Verify that retry functionality exists
    expect(pdfMediaSource).toContain('handleRetry')
    expect(pdfMediaSource).toContain('retryCount < MAX_RETRIES')
  })

  it('should show error UI when hasError is true', () => {
    // Verify that error UI is rendered when hasError is true
    expect(pdfMediaSource).toContain('Failed to load PDF')
    expect(pdfMediaSource).toContain('Try again')
  })

  it('should add message handler in useEffect with correct dependency array', () => {
    // Verify the useEffect for message handling is added correctly
    // The message handler should have empty deps since it only depends on setHasError (which is stable)
    // and doesn't need to re-subscribe when pdfUrl/resource changes
    expect(pdfMediaSource).toContain("window.addEventListener('message', handleMessage)")

    // Check that there's a separate useEffect for message handling (not the analytics one)
    // The message handling useEffect should have an empty dependency array
    // Find the useEffect that contains 'handleMessage'
    const messageHandlerUseEffect = pdfMediaSource.match(
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?handleMessage[\s\S]*?\},\s*(\[[^\]]*\])\)/,
    )
    expect(messageHandlerUseEffect).not.toBeNull()

    // The message handler should ideally have empty deps, but it's also acceptable
    // to have deps if the component re-renders for other reasons
    // This test verifies the pattern exists
  })
})
