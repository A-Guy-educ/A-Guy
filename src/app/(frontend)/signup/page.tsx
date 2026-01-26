import { getMeUser } from '@/infra/utils/getMeUser'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignupPageContent } from './SignupPageContent'

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create a new account',
}

interface SignupPageProps {
  searchParams: Promise<{ returnTo?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { user } = await getMeUser()
  const { returnTo } = await searchParams

  if (user) {
    redirect(returnTo || '/')
  }

  return <SignupPageContent returnTo={returnTo} />
}
