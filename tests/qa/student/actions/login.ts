// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Login action handler
 * Authenticates a user via Payload API and sets cookie
 * @fileType action-handler
 * @domain qa
 * @pattern session-actions
 */
import type { ActionContext, ActionHandler, ActionRef } from './types'
import { getPayload } from 'payload'
import config from '@payload-config'

export const login: ActionHandler = async (ctx, input) => {
  const { page, refs } = ctx
  const userRefInput = input?.userRef

  if (!userRefInput) {
    throw new Error('login action requires userRef input')
  }

  // Extract email and password
  let email: string
  let password: string

  if (typeof userRefInput === 'object') {
    // Already resolved to an object (shouldn't happen, but handle anyway)
    const userData = userRefInput as ActionRef
    email = userData.email as string
    password = userData.password as string
  } else if (typeof userRefInput === 'string') {
    // It's a string reference - look it up
    let refKey = userRefInput
    if (userRefInput.startsWith('$')) {
      refKey = userRefInput.slice(1)
    }

    const userData = refs[refKey]
    if (!userData) {
      throw new Error(`User ref "${refKey}" not found in context`)
    }

    email = userData.email as string
    password = userData.password as string
  } else {
    throw new Error('userRef must be a string')
  }

  if (!email || !password) {
    throw new Error(`User ref missing email or password`)
  }

  const payload = await getPayload({ config })

  const loginResult = await payload.login({
    collection: 'users',
    data: {
      email,
      password,
    },
  })

  if (!loginResult || !('token' in loginResult) || !loginResult.token) {
    throw new Error('Login failed - no token returned')
  }

  await page.context().addCookies([
    {
      name: 'payload-token',
      value: loginResult.token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ])
}
