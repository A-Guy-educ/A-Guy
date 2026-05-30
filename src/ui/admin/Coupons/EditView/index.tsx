'use client'

/**
 * CouponEditView — custom edit view for the Coupons collection.
 *
 * Renders DefaultEditView; the usage progress bar is added via a UI field
 * in the collection config (usageProgress field).
 *
 * @fileType component
 * @domain admin
 */

import React from 'react'
import { DefaultEditView } from '@payloadcms/ui'
import type { DocumentViewClientProps } from 'payload'

export const CouponEditView = (props: DocumentViewClientProps) => {
  return <DefaultEditView {...props} />
}

export default CouponEditView
