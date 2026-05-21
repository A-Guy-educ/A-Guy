/**
 * A-Guy Brand Bundle
 *
 * @fileType brand-bundle
 * @domain brands
 * @ai-summary Brand bundle entry point for the A-Guy brand.
 */

import type { Brand } from '../types'
import { aguyConfig } from './config'
import { Logo } from './components/Logo'

import en from './messages/en.json'
import he from './messages/he.json'

export const aguyBrand: Brand = {
  config: aguyConfig,
  Logo,
  messages: { en, he },
}
