import { describe, expect, it } from 'vitest'
import { getOnboardingRedirect } from '@/infra/onboarding/redirect'

describe('getOnboardingRedirect', () => {
  it('redirects to /onboarding/persona with returnTo for a safe path', () => {
    const result = getOnboardingRedirect('/study')
    expect(result).toBe('/onboarding/persona?returnTo=%2Fstudy')
  })

  it('redirects to /onboarding/persona with returnTo for /practice', () => {
    const result = getOnboardingRedirect('/practice')
    expect(result).toBe('/onboarding/persona?returnTo=%2Fpractice')
  })

  it('redirects to /onboarding/persona with returnTo for /ask', () => {
    const result = getOnboardingRedirect('/ask')
    expect(result).toBe('/onboarding/persona?returnTo=%2Fask')
  })

  it('redirects to /onboarding/persona with returnTo for /stats', () => {
    const result = getOnboardingRedirect('/stats')
    expect(result).toBe('/onboarding/persona?returnTo=%2Fstats')
  })

  it('returns /onboarding/persona without returnTo when already on onboarding', () => {
    const result = getOnboardingRedirect('/onboarding/persona')
    expect(result).toBe('/onboarding/persona')
  })

  it('returns / when given undefined', () => {
    const result = getOnboardingRedirect(undefined)
    expect(result).toBe('/onboarding/persona?returnTo=%2F')
  })

  it('rejects malicious URLs and returns /onboarding/persona with safe returnTo', () => {
    const result = getOnboardingRedirect('https://evil.com/steal-cookies')
    expect(result).toBe('/onboarding/persona?returnTo=%2F')
  })

  it('allows nested paths with query strings', () => {
    const result = getOnboardingRedirect('/courses/intro-to-cs/unit-1')
    expect(result).toBe('/onboarding/persona?returnTo=%2Fcourses%2Fintro-to-cs%2Funit-1')
  })
})
