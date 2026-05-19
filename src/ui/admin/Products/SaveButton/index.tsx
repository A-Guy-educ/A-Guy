'use client'

import React from 'react'
import { SaveButton, useTranslation } from '@payloadcms/ui'
import type { SaveButtonClientProps } from 'payload'

import { getProductStrings } from '../strings'

export const ProductsSaveButton: React.FC<SaveButtonClientProps> = (props) => {
  const { i18n } = useTranslation()
  const s = getProductStrings(i18n.language)

  const label = i18n.language.startsWith('he') ? s.saveProduct : 'Save'

  return <SaveButton label={label} {...props} />
}

export default ProductsSaveButton
