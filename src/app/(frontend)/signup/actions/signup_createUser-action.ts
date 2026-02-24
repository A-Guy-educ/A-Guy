'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { checkRateLimit } from './signup_rateLimit-action'
import {
  handleDuplicateEmailError,
  handlePayloadError,
  isDuplicateEmailError,
} from '../signup_handlers'
import { SignupSchema, type SignupResult } from '../signup_schemas'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { claimGuestConversations } from '@/server/services/guest-session-upgrade'
import { clearGuestSessionCookie, GUEST_SESSION_COOKIE_NAME } from '@/server/services/guest-session'

export async function signupAction(formData: FormData): Promise<SignupResult> {
  try {
    // 1. Extract data
    const rawData = {
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword'),
      website: formData.get('website'),
    }

    // 2. Honeypot check (anti-spam layer 1)
    if (rawData.website && rawData.website.toString().trim() !== '') {
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
      return { success: false, message: 'Validation failed', errors }
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
    const emailHash = Buffer.from(email).toString('base64')
    if (!checkRateLimit(emailHash)) {
      return {
        success: false,
        message: 'Too many signup attempts. Please try again later.',
      }
    }

    // 6. Create user via Payload
    const payload = await getPayload({ config })

    try {
      const user = await payload.create({
        collection: 'users',
        data: {
          name,
          email,
          password,
          role: AccountRole.Student, // Force role - never trust client input
        },
      })

      // 7. Auto-login: Set auth cookies
      const cookieStore = await cookies()
      const token = await payload.login({
        collection: 'users',
        data: { email, password },
      })

      if (token && 'token' in token && token.token) {
        cookieStore.set('payload-token', token.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60, // 7 days
          path: '/',
        })

        if (user.id) {
          try {
            const headers = new Headers()
            const guestToken = cookieStore.get(GUEST_SESSION_COOKIE_NAME)?.value
            if (guestToken) {
              await claimGuestConversations(payload, user.id, guestToken, headers)
              clearGuestSessionCookie(headers)
              cookieStore.delete(GUEST_SESSION_COOKIE_NAME)
            }
          } catch (claimError) {
            console.error('Failed to claim guest conversations:', claimError)
          }
        }
      }

      return { success: true, message: 'Account created successfully', userId: user.id }
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = error.message as string

        // Check for duplicate email (extends generic Payload error handling)
        if (isDuplicateEmailError(errorMessage)) {
          return handleDuplicateEmailError()
        }

        // Check for generic Payload validation errors
        const validationError = handlePayloadError(error, 'Please fix the errors below.')
        if (validationError) return validationError

        // Return actual error message
        return { success: false, message: errorMessage }
      }

      return {
        success: false,
        message: 'An error occurred during signup. Please try again.',
      }
    }
  } catch (error) {
    console.error('Signup error:', error)
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    }
  }
}
