/**
 * Brand Logo Consumer Component
 *
 * @fileType component
 * @domain brands
 * @ai-summary Generic brand logo wrapper that renders the active brand's Logo component.
 */

'use client'

import { getBrand } from '@/brands'

interface BrandLogoProps {
  className?: string
}

export function BrandLogo({ className }: BrandLogoProps) {
  const Logo = getBrand().Logo
  return <Logo className={className} />
}
