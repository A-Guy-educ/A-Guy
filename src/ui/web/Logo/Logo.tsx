import clsx from 'clsx'
import React from 'react'

import { TelescopeLogo } from '@/ui/web/TelescopeLogo'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
}

export const Logo = (props: Props) => {
  const { className } = props

  return <TelescopeLogo className={clsx(className)} />
}
