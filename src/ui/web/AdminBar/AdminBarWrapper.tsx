'use client'

import { useSelectedLayoutSegments } from 'next/navigation'

import { AdminBar } from './index'

interface AdminBarWrapperProps {
  adminBarProps?: {
    preview?: boolean
  }
}

export function AdminBarWrapper({ adminBarProps }: AdminBarWrapperProps) {
  const segments = useSelectedLayoutSegments()

  if (segments.length === 0) {
    return null
  }

  return <AdminBar adminBarProps={adminBarProps} />
}
