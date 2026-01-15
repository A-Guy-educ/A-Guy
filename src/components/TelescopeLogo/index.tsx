import Image from 'next/image'
import telescopeSvg from './telescope.svg'
import React from 'react'
import clsx from 'clsx'

interface TelescopeLogoProps {
  className?: string
}

export function TelescopeLogo({ className }: TelescopeLogoProps) {
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <Image
        src={telescopeSvg}
        alt="Telescope Logo"
        className="h-8 w-auto"
        width={224}
        height={204}
        priority
      />
      <span className="text-primary font-bold text-xl">Aguy</span>
    </div>
  )
}
