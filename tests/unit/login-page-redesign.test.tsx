// @vitest-environment jsdom

import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LoginPageContent } from '@/app/(frontend)/login/LoginPageContent'
import { LoginForm } from '@/app/(frontend)/login/LoginForm'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { PasswordLoginProvider } from '@/ui/web/providers/PasswordLoginProvider'
import enMessages from '../../src/i18n/en.json'
import heMessages from '../../src/i18n/he.json'

afterEach(() => {
  cleanup()
})

const renderWithI18n = (locale = 'en', children: React.ReactNode) => {
  const messages = locale === 'he' ? heMessages : enMessages
  return render(
    <I18nProvider locale={locale} messages={messages}>
      {children}
    </I18nProvider>,
  )
}

describe('Login Page Redesign - i18n translations', () => {
  it('Hebrew translations contain all new login keys', () => {
    const login = heMessages.auth.login as unknown as Record<string, string>
    expect(login.headingBold).toBe('שלום,')
    expect(login.headingRest).toBe('מוכנים להצליח?')
    expect(login.heroSubtitle).toBe('A-Guy המורה הפרטי שלכם')
    expect(login.quickLogin).toBe('כניסה מהירה')
    expect(login.freeRegistration).toBe('הרשמה ללא עלות')
    expect(login.secureAccess).toBe('גישה מהירה ומאובטחת.')
    expect(login.oneClickEntry).toBe('בלחיצה אחת אתם בפנים.')
    expect(login.needHelp).toBe('זקוקים לעזרה?')
  })

  it('English translations contain all new login keys', () => {
    const login = enMessages.auth.login as unknown as Record<string, string>
    expect(login.headingBold).toBe('Hello,')
    expect(login.headingRest).toBe('Ready to Succeed?')
    expect(login.heroSubtitle).toBe('A-Guy Your Personal Tutor')
    expect(login.quickLogin).toBe('Quick Login')
    expect(login.freeRegistration).toBe('Free Registration')
    expect(login.secureAccess).toBe('Fast and secure access.')
    expect(login.oneClickEntry).toBe("One click and you're in.")
    expect(login.needHelp).toBe('Need help?')
  })
})

describe('LoginPageContent', () => {
  it('renders hero heading as gradient text in Hebrew', () => {
    renderWithI18n('he', <LoginPageContent />)

    expect(screen.getByText('מוכנים להצליח?')).toBeTruthy()
  })

  it('renders hero heading as gradient text in English', () => {
    renderWithI18n('en', <LoginPageContent />)

    expect(screen.getByText('Ready to Succeed?')).toBeTruthy()
  })

  it('renders help link "זקוקים לעזרה?"', () => {
    renderWithI18n('he', <LoginPageContent />)

    expect(screen.getByText('זקוקים לעזרה?')).toBeTruthy()
  })

  it('renders help link in English', () => {
    renderWithI18n('en', <LoginPageContent />)

    expect(screen.getByText('Need help?')).toBeTruthy()
  })

  it('heading is a semantic h1 element', () => {
    renderWithI18n('en', <LoginPageContent />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeTruthy()
  })
})

describe('LoginForm - Google only mode (password disabled)', () => {
  const renderWithPasswordDisabled = (children: React.ReactNode) => {
    return render(
      <I18nProvider locale="he" messages={heMessages}>
        <PasswordLoginProvider enabled={false}>{children}</PasswordLoginProvider>
      </I18nProvider>,
    )
  }

  it('renders "כניסה מהירה" section label', () => {
    renderWithPasswordDisabled(<LoginForm />)

    expect(screen.getByText('כניסה מהירה')).toBeTruthy()
  })

  it('renders Google SSO button', () => {
    renderWithPasswordDisabled(<LoginForm />)

    expect(screen.getByRole('button', { name: /המשך עם Google/i })).toBeTruthy()
  })

  it('renders "הרשמה ללא עלות" link to /signup', () => {
    renderWithPasswordDisabled(<LoginForm />)

    const link = screen.getByRole('link', { name: /הרשמה ללא עלות/i })
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/signup')
  })

  it('renders card footer text', () => {
    renderWithPasswordDisabled(<LoginForm />)

    // The two footer texts are rendered in the same paragraph with whitespace between them
    expect(screen.getByText(/גישה מהירה ומאובטחת/)).toBeTruthy()
    expect(screen.getByText(/בלחיצה אחת אתם בפנים/)).toBeTruthy()
  })

  it('does NOT render email/password fields when password is disabled', () => {
    renderWithPasswordDisabled(<LoginForm />)

    expect(screen.queryByLabelText(/אימייל/)).toBeNull()
    expect(screen.queryByLabelText(/סיסמה/)).toBeNull()
  })
})

describe('LoginForm - Password enabled mode', () => {
  const renderWithPasswordEnabled = (children: React.ReactNode) => {
    return render(
      <I18nProvider locale="he" messages={heMessages}>
        <PasswordLoginProvider enabled={true}>{children}</PasswordLoginProvider>
      </I18nProvider>,
    )
  }

  it('renders email and password inputs when password is enabled', () => {
    renderWithPasswordEnabled(<LoginForm />)

    expect(screen.getByLabelText(/אימייל/)).toBeTruthy()
    expect(screen.getByLabelText(/סיסמה/)).toBeTruthy()
  })

  it('renders Google SSO button when password is enabled', () => {
    renderWithPasswordEnabled(<LoginForm />)

    expect(screen.getByRole('button', { name: /המשך עם Google/i })).toBeTruthy()
  })

  it('renders "הרשמה ללא עלות" link when password is enabled', () => {
    renderWithPasswordEnabled(<LoginForm />)

    expect(screen.getByRole('link', { name: /הרשמה ללא עלות/i })).toBeTruthy()
  })

  it('renders login button', () => {
    renderWithPasswordEnabled(<LoginForm />)

    expect(screen.getByRole('button', { name: /התחבר/ })).toBeTruthy()
  })

  it('renders "כניסה מהירה" label when password is enabled', () => {
    renderWithPasswordEnabled(<LoginForm />)

    expect(screen.getByText('כניסה מהירה')).toBeTruthy()
  })
})

describe('Functionality preservation', () => {
  it('registration link opens /signup in same window', () => {
    const { container } = render(
      <I18nProvider locale="he" messages={heMessages}>
        <PasswordLoginProvider enabled={false}>
          <LoginForm />
        </PasswordLoginProvider>
      </I18nProvider>,
    )

    const link = container.querySelector('a[href="/signup"]')
    expect(link).toBeTruthy()
    // No target="_blank" means it opens in same window
    expect(link?.getAttribute('target')).toBeNull()
  })
})
