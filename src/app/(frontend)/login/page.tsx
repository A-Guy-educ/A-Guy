import { getMeUser } from '@/infra/utils/getMeUser'
import { redirect } from 'next/navigation'
import { LoginPageContent } from './LoginPageContent'

export const metadata = { title: 'Log In' }

interface LoginPageProps {
  searchParams: Promise<{ returnTo?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { user } = await getMeUser()
  const { returnTo } = await searchParams

  if (user) {
    redirect(returnTo || '/')
  }

  return <LoginPageContent returnTo={returnTo} />
}
