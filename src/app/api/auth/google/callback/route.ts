import type { NextRequest } from 'next/server'

import { handleGoogleOAuthCallback } from '@/lib/auth/google-oauth-callback'

export async function GET(request: NextRequest) {
  return handleGoogleOAuthCallback(request)
}
