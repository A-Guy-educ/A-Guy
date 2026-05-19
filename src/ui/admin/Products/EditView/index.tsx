'use client'

import React from 'react'
import { DefaultEditView } from '@payloadcms/ui'
import type { DocumentViewClientProps } from 'payload'

export const ProductsEditView: React.FC<DocumentViewClientProps> = (props) => {
  return <DefaultEditView {...props} />
}

export default ProductsEditView
