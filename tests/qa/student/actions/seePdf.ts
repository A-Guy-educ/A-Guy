// eslint-disable @typescript-eslint/no-unused-vars
/**
 * SeePdf action - verifies PDF viewer state
 * Replaces: expectPdfVisible, expectPdfDownloadButtonVisible, expectPdfNotVisible
 * @fileType action-handler
 * @domain qa
 * @pattern pdf-actions
 * @normalized
 */
import type { ActionHandler } from './types'
import { SELECTORS } from '../shared/selectors'

type PdfState = 'visible' | 'hidden' | 'blocked'

export const seePdf: ActionHandler = async (ctx, input) => {
  const { page } = ctx
  const state = input?.state as PdfState | undefined
  const timeout = (input?.timeout as number) || 5000

  if (!state) {
    throw new Error('seePdf action requires state input (visible, hidden, or blocked)')
  }

  switch (state) {
    case 'visible': {
      const iframe = page.locator(SELECTORS.pdf.iframe).first()
      await iframe.waitFor({ state: 'visible', timeout })
      const src = await iframe.getAttribute('src')
      if (!src) {
        throw new Error('PDF iframe src is empty')
      }
      break
    }

    case 'blocked': {
      const downloadButton = page.locator(SELECTORS.pdf.downloadButton).first()
      await downloadButton.waitFor({ state: 'visible', timeout })
      const href = await downloadButton.getAttribute('href')
      if (!href) {
        throw new Error('Download button has no href')
      }
      break
    }

    case 'hidden': {
      const iframe = page.locator(SELECTORS.pdf.iframe).first()
      await iframe.waitFor({ state: 'hidden', timeout: 3000 })
      break
    }
  }
}
