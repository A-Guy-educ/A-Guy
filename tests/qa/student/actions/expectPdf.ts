// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Expect PDF visible action
 * Verifies PDF viewer is visible in the page
 * @fileType action-handler
 * @domain qa
 * @pattern pdf-actions
 */
import type { ActionHandler } from './types'

export const expectPdfVisible: ActionHandler = async (ctx, input) => {
  const { page } = ctx
  const selector = (input?.selector as string) || 'iframe'
  const timeout = (input?.timeout as number) || 5000

  const element = page.locator(selector).first()

  await element.waitFor({ state: 'visible', timeout })

  // Check iframe has loaded (src is not empty)
  const src = await element.getAttribute('src')
  if (!src) {
    throw new Error(`PDF iframe src is empty`)
  }
}

export const expectPdfDownloadButtonVisible: ActionHandler = async (ctx, input) => {
  const { page } = ctx
  const timeout = (input?.timeout as number) || 5000

  // Download button appears when iframe is blocked
  const downloadButton = page.locator('a:has-text("Download")').first()

  await downloadButton.waitFor({ state: 'visible', timeout })

  // Verify it has href attribute
  const href = await downloadButton.getAttribute('href')
  if (!href) {
    throw new Error(`Download button has no href`)
  }
}

export const expectPdfNotVisible: ActionHandler = async (ctx, input) => {
  const { page } = ctx
  const selector = (input?.selector as string) || 'iframe'

  const element = page.locator(selector).first()

  await element.waitFor({ state: 'hidden', timeout: 3000 })
}
