'use server'

import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'

// Rate limiting store (in-memory - use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

// Validation schema
const SignupSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  // Honeypot field
  website: z.string().optional(),
  // Turnstile token
  'cf-turnstile-response': z.string().optional(),
})

interface SignupResult {
  success: boolean
  message?: string
  errors?: Record<string, string>
}

// Rate limiting helper
function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const limit = rateLimitStore.get(identifier)

  if (!limit || now > limit.resetAt) {
    // Reset or create new limit
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + 15 * 60 * 1000, // 15 minutes
    })
    return true
  }

  if (limit.count >= 5) {
    // Exceeded limit: 5 attempts per 15 minutes
    return false
  }

  limit.count++
  return true
}

// Helper function to verify Turnstile token
async function verifyTurnstileToken(token: string | undefined): Promise<boolean> {
  console.log('[verifyTurnstileToken] Called with token:', {
    hasToken: !!token,
    tokenLength: token?.length || 0,
  })

  if (!token) {
    console.log('[verifyTurnstileToken] No token provided - returning false')
    return false
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY
  console.log('[verifyTurnstileToken] Secret key:', secretKey ? 'LOADED' : 'NOT FOUND')

  // If no secret key, skip verification (development mode)
  if (!secretKey) {
    console.warn(
      '[verifyTurnstileToken] Turnstile secret key not configured - skipping verification (returning true)',
    )
    return true
  }

  try {
    console.log('[verifyTurnstileToken] Making request to Cloudflare...')
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    })

    const data = await response.json()
    console.log('[verifyTurnstileToken] Cloudflare response:', data)
    return data.success === true
  } catch (error) {
    console.error('[verifyTurnstileToken] Error during verification:', error)
    return false
  }
}

export async function signupAction(formData: FormData): Promise<SignupResult> {
  try {
    console.log('=== SIGNUP ACTION STARTED ===')

    // 1. Extract data
    const rawData = {
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword'),
      website: formData.get('website'),
      'cf-turnstile-response': formData.get('cf-turnstile-response'),
    }

    console.log('1. Raw data extracted:', {
      hasName: !!rawData.name,
      hasEmail: !!rawData.email,
      hasPassword: !!rawData.password,
      hasTurnstileToken: !!rawData['cf-turnstile-response'],
      turnstileTokenLength: rawData['cf-turnstile-response']?.toString().length || 0,
    })

    // 2. Honeypot check (anti-spam layer 1)
    if (rawData.website && rawData.website.toString().trim() !== '') {
      // Bot detected - reject silently with generic message
      return {
        success: false,
        message: 'Unable to create account. Please try again.',
      }
    }

    // 3. Validate with Zod
    const parsed = SignupSchema.safeParse(rawData)

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

    const { name, email, password, confirmPassword } = parsed.data

    // 4. Check password match
    if (password !== confirmPassword) {
      return {
        success: false,
        errors: { confirmPassword: 'Passwords do not match' },
      }
    }

    // 5. Rate limiting (anti-spam layer 2)
    // Use email hash as identifier
    const emailHash = Buffer.from(email).toString('base64')
    if (!checkRateLimit(emailHash)) {
      return {
        success: false,
        message: 'Too many signup attempts. Please try again later.',
      }
    }

    // 6. Verify Turnstile token (anti-spam layer 3)
    const turnstileToken = parsed.data['cf-turnstile-response']
    console.log('2. About to verify Turnstile token:', {
      hasToken: !!turnstileToken,
      tokenLength: turnstileToken?.length || 0,
    })

    const isTurnstileValid = await verifyTurnstileToken(turnstileToken)

    console.log('3. Turnstile verification result:', isTurnstileValid)

    if (!isTurnstileValid) {
      console.log('4. CAPTCHA verification FAILED - rejecting signup')
      return {
        success: false,
        message: 'CAPTCHA verification failed. Please try again.',
        errors: {
          general: 'CAPTCHA verification failed',
        },
      }
    }

    console.log('5. CAPTCHA verification PASSED - proceeding with user creation')

    // 7. Create user via Payload
    const payload = await getPayload({ config })

    try {
      await payload.create({
        collection: 'users',
        data: {
          name,
          email,
          password,
          // Force role to 'student' - never trust client input for roles
          roles: ['student'],
        },
      })

      // 8. Auto-login: Set auth cookies
      const cookieStore = await cookies()
      const token = await payload.login({
        collection: 'users',
        data: {
          email,
          password,
        },
      })

      if (token && 'token' in token && token.token) {
        // Set the Payload auth cookie
        cookieStore.set('payload-token', token.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60, // 7 days
          path: '/',
        })
      }

      return {
        success: true,
        message: 'Account created successfully',
      }
    } catch (error) {
      // Check if it's a duplicate email error (security-sensitive)
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = error.message as string

        if (
          errorMessage.includes('duplicate') ||
          errorMessage.includes('unique') ||
          errorMessage.includes('E11000')
        ) {
          // Provide helpful message for duplicate email
          return {
            success: false,
            message: 'An account with this email already exists. Would you like to log in instead?',
            errors: {
              email: 'This email is already registered',
            },
          }
        }

        // Check for Payload validation errors
        if ('data' in error && error.data && typeof error.data === 'object') {
          const payloadError = error.data as any
          const errors: Record<string, string> = {}

          // Parse Payload field errors
          if (payloadError.errors && Array.isArray(payloadError.errors)) {
            payloadError.errors.forEach((err: any) => {
              if (err.path && err.message) {
                errors[err.path] = err.message
              }
            })
          }

          if (Object.keys(errors).length > 0) {
            return {
              success: false,
              message: 'Please fix the errors below.',
              errors,
            }
          }
        }

        // Return the actual error message for other validation errors
        return {
          success: false,
          message: errorMessage,
        }
      }

      // Generic error for unknown failures
      return {
        success: false,
        message: 'An error occurred during signup. Please try again.',
      }
    }
  } catch (error) {
    // Log the error for debugging (in production, use proper logging)
    console.error('Signup error:', error)

    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    }
  }
}
