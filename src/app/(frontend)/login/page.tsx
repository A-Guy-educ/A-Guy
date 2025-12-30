import React from 'react'
import type { Metadata } from 'next'
import { LoginPageContent } from './LoginPageContent'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Log In',
  description: 'Log in to your account',
}

export default async function LoginPage() {
  // Quick check: if user has a token, redirect to home
  // We don't validate the token here for performance - let the client handle it
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')

  if (token) {
    redirect('/')
  }

  return <LoginPageContent />
}
