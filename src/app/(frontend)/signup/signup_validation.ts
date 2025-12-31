export function validateSignupForm(
  formData: FormData,
  turnstileToken: string,
  t: (key: string) => string,
): Record<string, string> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const name = formData.get('name') as string

  const errors: Record<string, string> = {}

  if (!name || name.trim().length === 0) {
    errors.name = t('errors.nameRequired')
  }

  if (!email || !email.includes('@')) {
    errors.email = t('errors.invalidEmail')
  }

  if (!password || password.length < 8) {
    errors.password = t('errors.passwordTooShort')
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = t('errors.passwordMismatch')
  }

  if (!turnstileToken) {
    errors.general = 'Please complete the CAPTCHA verification'
  }

  return errors
}
