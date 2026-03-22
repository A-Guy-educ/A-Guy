// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Resize viewport action - sets viewport size for responsive testing
 * @fileType action-handler
 * @domain qa
 * @pattern utility-actions
 */
import type { ActionHandler } from './types'
import { VIEWPORT_PRESETS, type ViewportPreset } from '../shared/selectors'

export const resizeViewport: ActionHandler = async (ctx, input) => {
  const { page } = ctx
  const preset = input?.preset as ViewportPreset | undefined
  const width = input?.width as number | undefined
  const height = input?.height as number | undefined

  if (!preset && (width === undefined || height === undefined)) {
    throw new Error('resizeViewport requires either preset or width+height inputs')
  }

  if (preset) {
    const { width: w, height: h } = VIEWPORT_PRESETS[preset]
    await page.setViewportSize({ width: w, height: h })
  } else {
    await page.setViewportSize({ width: width!, height: height! })
  }
}
