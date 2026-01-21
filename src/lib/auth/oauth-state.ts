import { cookies } from 'next/headers'
import crypto from 'crypto'
import { MODE_COOKIE, RETURN_TO_COOKIE, STATE_COOKIE } from './oauth-cookies'

export function createOAuthState(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function verifyOAuthState(
  state: string,
): Promise<{ valid: boolean; returnTo?: string; mode?: 'login' | 'link' }> {
  const cookieStore = await cookies()
  const storedState = cookieStore.get(STATE_COOKIE)?.value
  const returnTo = cookieStore.get(RETURN_TO_COOKIE)?.value
  const mode = cookieStore.get(MODE_COOKIE)?.value === 'link' ? 'link' : 'login'

  return {
    valid: storedState === state,
    returnTo,
    mode,
  }
}
