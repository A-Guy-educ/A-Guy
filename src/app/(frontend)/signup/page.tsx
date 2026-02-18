import { redirect } from 'next/navigation'

/**
 * Signup page redirects to login.
 *
 * Google OAuth is the only auth method (task 21).
 * Email/password signup backend code is preserved in this directory
 * for future re-enablement if needed.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const query = new URLSearchParams(params).toString()
  redirect(query ? `/login?${query}` : '/login')
}
