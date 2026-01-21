import { requireRegistration } from '@/lib/auth/registration-gate'
import { AccountPageContent } from './AccountPageContent'

export const metadata = { title: 'Account' }

export default async function AccountPage() {
  const user = await requireRegistration('/account')

  return <AccountPageContent user={user} />
}
