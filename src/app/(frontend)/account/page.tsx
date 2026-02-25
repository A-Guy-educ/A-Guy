import { redirect } from 'next/navigation'
import { getMeUser } from '@/infra/utils/getMeUser'
import { AccountPageContent } from './AccountPageContent'

export const metadata = { title: 'Account' }

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>
}) {
  const { user } = await getMeUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  return <AccountPageContent user={user} initialSection={params.section} />
}
