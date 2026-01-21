import { getMeUser } from '@/utilities/getMeUser'
import { redirect } from 'next/navigation'

export async function requireRegistration(returnTo?: string) {
  const { user } = await getMeUser()

  if (!user) {
    const destination = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup'
    redirect(destination)
  }

  const isRegistered = Boolean(user.registrationMethod && user.registeredAt)

  if (!isRegistered) {
    const destination = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup'
    redirect(destination)
  }

  return user
}
