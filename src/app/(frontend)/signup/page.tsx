import React from 'react'
import type { Metadata } from 'next'
import { SignupPageContent } from './SignupPageContent'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create a new account',
}

export default async function SignupPage() {
  // Quick check: if user has a token, redirect to home
  // We don't validate the token here for performance
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')

  if (token) {
    redirect('/')
  }

  return <SignupPageContent />
}
