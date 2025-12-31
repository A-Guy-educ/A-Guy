import { z } from 'zod'

export const SignupSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  website: z.string().optional(),
  'cf-turnstile-response': z.string().optional(),
})

export interface SignupResult {
  success: boolean
  message?: string
  errors?: Record<string, string>
}
