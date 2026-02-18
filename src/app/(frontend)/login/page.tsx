import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getMeUser } from '@/infra/utils/getMeUser'
import { reloadConfigValues } from '@/infra/config/runtime'
import { isPasswordLoginEnabled } from '@/infra/config/system-params'
import { LoginPageContent } from './LoginPageContent'

export const metadata = { title: 'Log In' }

export default async function LoginPage() {
  const { user } = await getMeUser()

  if (user) {
    redirect('/')
  }

  const payload = await getPayload({ config })
  await reloadConfigValues(payload)
  const passwordEnabled = await isPasswordLoginEnabled()

  return <LoginPageContent passwordEnabled={passwordEnabled} />
}
