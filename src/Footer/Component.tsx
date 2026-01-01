import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import type { Footer } from '@/payload-types'

import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'
import { FooterClient } from './Component.client'

export async function Footer() {
  const footerData: Footer = await getCachedGlobal('footer', 1)()

  return <FooterClient data={footerData} />
}
