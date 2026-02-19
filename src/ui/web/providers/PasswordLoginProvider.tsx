'use client'

import React, { createContext, useContext } from 'react'

const PasswordLoginContext = createContext(false)

export function PasswordLoginProvider({
  enabled,
  children,
}: {
  enabled: boolean
  children: React.ReactNode
}) {
  return <PasswordLoginContext.Provider value={enabled}>{children}</PasswordLoginContext.Provider>
}

export function usePasswordLogin(): boolean {
  return useContext(PasswordLoginContext)
}
