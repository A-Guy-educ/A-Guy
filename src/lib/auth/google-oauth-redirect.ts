import { NextRequest, NextResponse } from 'next/server'

export function sanitizeReturnTo(value?: string | null) {
  if (!value) return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  return value
}

export function buildRedirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url))
}
