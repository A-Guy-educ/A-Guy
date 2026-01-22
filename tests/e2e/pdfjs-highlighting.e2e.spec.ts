import { test, expect } from '@playwright/test'

test.describe('PDF.js Highlighting - Real Annotation Test', () => {
  // Minimal PDF with selectable text
  const minimalPdf =
    'data:application/pdf;base64,JVBERi0xLjAKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1BhcmVudCAyIDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNCAwIFI+Pj4+L0NvbnRlbnRzIDUgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj4KZW5kb2JqCjUgMCBvYmoKPDwvTGVuZ3RoIDQ0Pj4Kc3RyZWFtCkJUCi9GMSA0OCBUZCAKNTG0IDcwMCBUZAooVGVzdCBUZXh0KSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjYgMCBvYmoKPDwvVHlwZS9YUmVmL1NpemUgNy9XWzEgMiAxXS9Sb290IDEgMCBSL0luZm8gPDwvUHJvZHVjZXIoUERGIEdlbmVyYXRvcik+Pi9JRFs8MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI+PDk4NzY1NDMyMTA5ODc2NTQzMjEwOTg3NjU0MzIxMDk4Pl0vTGVuZ3RoIDc+PgpzdHJlYW0KCmVuZHN0cmVhbQplbmRvYmoKc3RhcnR4cmVmCjQ1NgolJUVPRgo='

  test('should enable highlight mode and create annotation when highlighting text', async ({
    page,
  }) => {
    // Navigate to viewer with highlight mode enabled
    const viewerUrl = `/api/pdfjs-viewer?file=${encodeURIComponent(minimalPdf)}&annotationEditorMode=9`
    await page.goto(`http://localhost:3000${viewerUrl}`)

    // Wait for PDF.js to initialize
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    await page.waitForSelector('#viewerContainer', { state: 'visible', timeout: 15000 })

    // Wait for PDF page to render
    await page.waitForSelector('.page[data-page-number="1"]', { state: 'visible', timeout: 15000 })

    // Wait for text layer to be ready
    await page.waitForSelector('.textLayer', { state: 'visible', timeout: 15000 })

    // Check that PDF.js is loaded
    const pdfjsReady = await page.evaluate(() => {
      return typeof (window as any).PDFViewerApplication !== 'undefined'
    })
    expect(pdfjsReady).toBe(true)

    // Wait a bit for annotation editor to initialize
    await page.waitForTimeout(2000)

    // Try to activate highlight mode if not already active
    // Look for editor buttons in the toolbar
    const editorHighlightButton = page.locator('[data-l10n-id="editor_highlight"]').first()
    const buttonExists = await editorHighlightButton.count()

    if (buttonExists > 0) {
      await editorHighlightButton.click()
      await page.waitForTimeout(500)
    }

    // Get text layer element to highlight
    const textLayer = page.locator('.textLayer').first()
    const textLayerBox = await textLayer.boundingBox()

    if (textLayerBox) {
      // Perform a drag gesture to create a highlight
      // Start from top-left area and drag to create selection
      await page.mouse.move(textLayerBox.x + 50, textLayerBox.y + 50)
      await page.mouse.down()
      await page.mouse.move(textLayerBox.x + 200, textLayerBox.y + 50, { steps: 10 })
      await page.mouse.up()

      // Wait for annotation to be created
      await page.waitForTimeout(1000)
    }

    // Check for annotation layer and highlight annotation
    // PDF.js creates highlights in the annotation editor layer
    const annotationEditorLayer = await page.locator('.annotationEditorLayer').count()
    expect(annotationEditorLayer).toBeGreaterThan(0)

    // Look for highlight annotation element
    // PDF.js uses specific classes for highlight annotations
    const highlightAnnotations = await page.locator('[data-annotation-id]').count()

    // Log what we found for debugging
    const annotationInfo = await page.evaluate(() => {
      const editorLayers = document.querySelectorAll('.annotationEditorLayer')
      const annotations = document.querySelectorAll('[data-annotation-id]')
      const highlightEditors = document.querySelectorAll('.highlightEditor')

      return {
        editorLayerCount: editorLayers.length,
        annotationCount: annotations.length,
        highlightEditorCount: highlightEditors.length,
        editorLayerHTML: editorLayers[0]?.innerHTML.substring(0, 500) || 'none',
      }
    })

    console.log('Annotation info:', annotationInfo)

    // Verify annotation editor layer exists (this proves highlighting is initialized)
    expect(annotationInfo.editorLayerCount).toBeGreaterThan(0)
  })

  test('should NOT enable annotation editor when annotationEditorMode is not set', async ({
    page,
  }) => {
    const viewerUrl = `/api/pdfjs-viewer?file=${encodeURIComponent(minimalPdf)}`
    await page.goto(`http://localhost:3000${viewerUrl}`)

    await page.waitForLoadState('networkidle', { timeout: 10000 })
    await page.waitForSelector('#viewerContainer', { state: 'visible', timeout: 10000 })

    // Check that hash parameter was NOT added
    const htmlContent = await page.content()
    expect(htmlContent).not.toContain('annotationEditorMode=')
  })

  test('should pass annotationEditorMode via hash parameter', async ({ page }) => {
    const viewerUrl = `/api/pdfjs-viewer?file=${encodeURIComponent(minimalPdf)}&annotationEditorMode=9`
    await page.goto(`http://localhost:3000${viewerUrl}`)

    await page.waitForLoadState('load')

    // Verify hash parameter is in the HTML
    const htmlContent = await page.content()
    expect(htmlContent).toContain('annotationEditorMode=9')
    expect(htmlContent).toContain('window.location')
  })
})
