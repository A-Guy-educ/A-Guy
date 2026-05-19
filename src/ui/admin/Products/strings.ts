/**
 * Localized strings for the Products admin components.
 *
 * Admin panel supports English + Hebrew. Selection happens at runtime via
 * `useTranslation().i18n.language` from @payloadcms/ui.
 */

interface ProductStrings {
  // Actions
  saveProduct: string
}

const EN: ProductStrings = {
  saveProduct: 'Save Product',
}

const HE: ProductStrings = {
  saveProduct: 'שמור מוצר',
}

export function getProductStrings(lang: string): ProductStrings {
  return lang.toLowerCase().startsWith('he') ? HE : EN
}
