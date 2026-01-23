import React from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getMeUser } from '@/infra/utils/getMeUser'
import { SignupPageContent } from './SignupPageContent'

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create a new account',
}

export default async function SignupPage() {
  const { user } = await getMeUser()

  if (user) {
    redirect('/')
  }

  return <SignupPageContent />
}
