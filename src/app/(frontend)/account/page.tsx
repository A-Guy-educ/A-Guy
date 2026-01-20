import { redirect } from 'next/navigation'
import { getMeUser } from '@/utilities/getMeUser'
import { AccountPageContent } from './AccountPageContent'

export const metadata = { title: 'Account' }

export default async function AccountPage() {
  const { user } = await getMeUser()

  if (!user) {
    redirect('/login')
  }

  return <AccountPageContent user={user} />
}
