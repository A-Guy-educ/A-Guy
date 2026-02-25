'use client'

import { useState, useEffect } from 'react'

import type { User } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/ui/web/components/accordion'
import { DetailsSection } from './DetailsSection'
import { PreferencesSection } from './PreferencesSection'
import { TeachersProfileSection } from './TeachersProfileSection'
import { SelectedCourseCard } from './SelectedCourseCard'

const VALID_SECTIONS = ['details', 'courses', 'preferences', 'teachers-profile'] as const
type ValidSection = (typeof VALID_SECTIONS)[number]

function isValidSection(section: string | undefined): section is ValidSection {
  return section !== undefined && VALID_SECTIONS.includes(section as ValidSection)
}

interface AccountHubProps {
  user: User
  initialSection?: string
}

export function AccountHub({ user, initialSection }: AccountHubProps) {
  const t = useTranslations('auth.account')
  const [value, setValue] = useState<string>('details')

  // Set initial value based on props
  useEffect(() => {
    if (isValidSection(initialSection)) {
      setValue(initialSection)
    } else {
      setValue('details')
    }
  }, [initialSection])

  const handleValueChange = (newValue: string) => {
    setValue(newValue)
    const url = new URL(window.location.href)
    if (newValue) {
      url.searchParams.set('section', newValue)
    } else {
      url.searchParams.delete('section')
    }
    window.history.replaceState(null, '', url.toString())
  }

  return (
    <Accordion
      type="single"
      collapsible
      value={value}
      onValueChange={handleValueChange}
      className="w-full"
    >
      <AccordionItem value="details">
        <AccordionTrigger className="ps-4">{t('sectionDetails')}</AccordionTrigger>
        <AccordionContent className="px-4">{<DetailsSection user={user} />}</AccordionContent>
      </AccordionItem>

      <AccordionItem value="courses">
        <AccordionTrigger className="ps-4">{t('sectionCourses')}</AccordionTrigger>
        <AccordionContent className="px-4">{<SelectedCourseCard />}</AccordionContent>
      </AccordionItem>

      <AccordionItem value="preferences">
        <AccordionTrigger className="ps-4">{t('sectionPreferences')}</AccordionTrigger>
        <AccordionContent className="px-4">{<PreferencesSection />}</AccordionContent>
      </AccordionItem>

      <AccordionItem value="teachers-profile">
        <AccordionTrigger className="ps-4">{t('sectionTeachersProfile')}</AccordionTrigger>
        <AccordionContent className="px-4">{<TeachersProfileSection />}</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
