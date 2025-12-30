'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function logoutAction() {
  try {
    const cookieStore = await cookies()

    // Clear the auth cookie
    cookieStore.delete('payload-token')

    return { success: true }
  } catch (_error) {
    return {
      success: false,
      message: 'Logout failed. Please try again.',
    }
  }
}

export async function logoutAndRedirect() {
  await logoutAction()
  redirect('/login')
}
