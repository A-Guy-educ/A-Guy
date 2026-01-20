import { redirect } from 'next/navigation'
import { getMeUser } from '@/utilities/getMeUser'
import { LoginPageContent } from './LoginPageContent'

export const metadata = { title: 'Log In' }

export default async function LoginPage() {
  const { user } = await getMeUser()

  if (user) {
    redirect('/')
  }

  return <LoginPageContent />
}
