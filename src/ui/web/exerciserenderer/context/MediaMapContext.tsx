'use client'

import { createContext, useContext } from 'react'
import type { Media } from '@/payload-types'

export type MediaMap = Record<string, Media>

const MediaMapContext = createContext<MediaMap>({})

export const MediaMapProvider = MediaMapContext.Provider

export function useMediaMap(): MediaMap {
  return useContext(MediaMapContext)
}
