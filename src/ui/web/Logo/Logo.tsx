import clsx from 'clsx'
import React from 'react'

import { BrandLogo } from '@/ui/web/BrandLogo'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
}

export const Logo = (props: Props) => {
  const { className } = props

  return <BrandLogo className={clsx(className)} />
}
