import Image from 'next/image'
import telescopeSvg from './telescope.svg'
import React from 'react'
import { cn } from '@/infra/utils/ui'

interface TelescopeLogoProps {
  className?: string
}

export function TelescopeLogo({ className }: TelescopeLogoProps) {
  return (
    <div className={cn('flex items-center gap-content-gap-xs', className)}>
      <Image
        src={telescopeSvg}
        alt="Telescope Logo"
        className="h-8 w-auto"
        width={224}
        height={204}
        priority
      />
      <span className="text-primary font-bold text-heading-xl">Aguy</span>
    </div>
  )
}
