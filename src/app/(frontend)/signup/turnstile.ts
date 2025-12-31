export async function verifyTurnstileToken(token: string | undefined): Promise<boolean> {
  if (!token) return false

  const secretKey = process.env.TURNSTILE_SECRET_KEY

  // If no secret key, skip verification (development mode)
  if (!secretKey) {
    console.warn('Turnstile secret key not configured - skipping verification')
    return true
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    })

    const data = await response.json()
    return data.success === true
  } catch (error) {
    console.error('Turnstile verification error:', error)
    return false
  }
}
