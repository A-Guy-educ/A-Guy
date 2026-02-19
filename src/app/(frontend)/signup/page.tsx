import { redirect } from 'next/navigation'
import { isPasswordLoginEnabled } from '@/infra/config/system-params'
import { SignupPageContent } from './SignupPageContent'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const passwordEnabled = await isPasswordLoginEnabled()

  if (!passwordEnabled) {
    const params = await searchParams
    const query = new URLSearchParams(params).toString()
    redirect(query ? `/login?${query}` : '/login')
  }

  return <SignupPageContent />
}
