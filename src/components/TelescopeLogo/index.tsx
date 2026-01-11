import Image from 'next/image'
import telescopeSvg from './telescope.svg'

interface TelescopeLogoProps {
  className?: string
}

export function TelescopeLogo({ className }: TelescopeLogoProps) {
  return (
    <Image
      src={telescopeSvg}
      alt="Aguy Logo"
      className={className}
      width={224}
      height={204}
      priority
    />
  )
}
