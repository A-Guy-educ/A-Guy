import { detectBrowserLocale } from '@/i18n/config'
import { PRODUCT_EVENTS } from '@/lib/analytics/contracts/events'
import { updateCachedUserProperties } from '@/lib/analytics/utils/user-properties-cache'
import type { Analytics } from '@/lib/analytics/types'

export function trackRegistrationSuccess({
  analytics,
  formData,
  userId,
}: {
  analytics: Analytics
  formData: FormData
  userId: string
}) {
  analytics.track(PRODUCT_EVENTS.REGISTRATION_COMPLETED, {
    user_id: userId,
    auth_method: 'email',
  })

  const userProperties: Record<string, unknown> = {
    user_id: userId,
    is_new_user: true,
    auth_method: 'email',
    signup_date: new Date().toISOString(),
    role: 'student',
  }

  const email = formData.get('email') as string
  const name = formData.get('name') as string
  if (email) {
    userProperties.$email = email
  }
  if (name) {
    userProperties.$name = name
  }

  if (typeof window !== 'undefined') {
    userProperties.locale = detectBrowserLocale()
  }

  updateCachedUserProperties(userProperties)
  analytics.track(PRODUCT_EVENTS.USER_IDENTIFIED, userProperties)
  analytics.identify(userId, userProperties)
}
