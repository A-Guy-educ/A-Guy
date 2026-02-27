import { redirect } from 'next/navigation'

import { sanitizeReturnTo } from '@/infra/auth/oauth_sanitize'
import { getMeUser } from '@/infra/utils/getMeUser'

import { PersonaSelectionStep } from './PersonaSelectionStep'

export const metadata = { title: 'Choose Your Teacher' }

export default async function PersonaSelectionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const { user } = await getMeUser()

  if (!user) {
    redirect('/signup')
  }

  const params = await searchParams
  let returnTo = sanitizeReturnTo(params.returnTo)

  // Guard against redirect loops
  if (returnTo.startsWith('/onboarding/persona')) {
    returnTo = '/'
  }

  return <PersonaSelectionStep returnTo={returnTo} />
}
