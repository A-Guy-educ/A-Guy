'use server'

import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// Validation schema
const LoginSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
  'cf-turnstile-response': z.string().optional(),
})

interface LoginResult {
  success: boolean
  message?: string
  errors?: Record<string, string>
}

// Helper function to verify Turnstile token
async function verifyTurnstileToken(token: string | undefined): Promise<boolean> {
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

export async function loginAction(formData: FormData): Promise<LoginResult> {
  // 1. Extract data
  try {
    const rawData = {
      email: formData.get('email'),
      password: formData.get('password'),
      'cf-turnstile-response': formData.get('cf-turnstile-response'),
    }

    // 2. Validate with Zod
    const parsed = LoginSchema.safeParse(rawData)

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      parsed.error.issues.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message
        }
      })
      return {
        success: false,
        message: 'Validation failed',
        errors,
      }
    }

    const { email, password } = parsed.data
    const turnstileToken = parsed.data['cf-turnstile-response']

    // 3. Verify Turnstile token
    const isTurnstileValid = await verifyTurnstileToken(turnstileToken)

    if (!isTurnstileValid) {
      return {
        success: false,
        message: 'CAPTCHA verification failed. Please try again.',
        errors: {
          general: 'CAPTCHA verification failed',
        },
      }
    }

    // 4. Attempt login via Payload
    const payload = await getPayload({ config })

    let token
    try {
      token = await payload.login({
        collection: 'users',
        data: {
          email,
          password,
        },
      })
    } catch (error) {
      console.error('Login error:', error)

      // Check for invalid credentials
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = error.message as string

        if (
          errorMessage.includes('credentials') ||
          errorMessage.includes('password') ||
          errorMessage.includes('email')
        ) {
          return {
            success: false,
            message: 'Invalid email or password',
            errors: {
              general: 'Invalid email or password',
            },
          }
        }
      }

      return {
        success: false,
        message: 'An error occurred during login. Please try again.',
      }
    }

    // If login succeeded, set cookie and redirect
    if (token && 'token' in token && token.token) {
      // Set the Payload auth cookie
      const cookieStore = await cookies()
      cookieStore.set('payload-token', token.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      })

      // Get user to determine redirect
      if ('user' in token && token.user && typeof token.user === 'object') {
        const user = token.user as { roles?: string[] }
        const roles = user.roles || []

        // Redirect based on role (this will throw, but that's expected)
        if (roles.includes('admin')) {
          redirect('/admin')
        } else {
          redirect('/courses')
        }
      } else {
        // Default redirect if no user info
        redirect('/courses')
      }
    }
  } catch (error) {
    // Re-throw Next.js redirect errors FIRST (they're not actually errors)
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error
    }

    console.error('Login action error:', error)

    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    }
  }

  // Should not reach here if login succeeded
  return {
    success: false,
    message: 'Login failed. Please try again.',
  }
}
