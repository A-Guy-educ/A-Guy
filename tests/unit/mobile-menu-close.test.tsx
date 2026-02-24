// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MobileMenu, MobileMenuButton } from '@/ui/web/header/MobileMenu'
import type { Header, User } from '@/payload-types'

// Mock the providers
vi.mock('@/ui/web/providers/PasswordLoginProvider', () => ({
  usePasswordLogin: () => true,
}))

vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/ui/web/Link', () => ({
  CMSLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

vi.mock('@/infra/loading/components/SystemLink', () => ({
  SystemLink: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <a onClick={onClick}>{children}</a>
  ),
}))

vi.mock('@/ui/web/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div>Language Switcher</div>,
}))

vi.mock('./MobileMenuAuthSection', () => ({
  MobileMenuAuthSection: () => <div>Auth Section</div>,
}))

describe('MobileMenu', () => {
  const mockHeaderData: Header = {
    id: '1',
    navItems: [
      {
        link: {
          type: 'reference',
          label: 'Home',
          url: '/',
        },
      },
      {
        link: {
          type: 'reference',
          label: 'Courses',
          url: '/courses',
        },
      },
    ],
  } as Header

  const mockUser: User = {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
  } as User

  describe('Close Button', () => {
    it('should call onClose when close button is clicked', async () => {
      const onClose = vi.fn()

      render(
        <MobileMenu
          isOpen={true}
          onClose={onClose}
          data={mockHeaderData}
          user={mockUser}
          isAuthLoading={false}
          version="1.0.0"
        />,
      )

      const closeButton = screen.getByLabelText('Close menu')
      expect(closeButton).toBeTruthy()
      expect(closeButton.getAttribute('type')).toBe('button')

      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1)
      })
    })

    it('should call onClose when overlay is clicked', async () => {
      const onClose = vi.fn()

      const { container } = render(
        <MobileMenu
          isOpen={true}
          onClose={onClose}
          data={mockHeaderData}
          user={mockUser}
          isAuthLoading={false}
          version="1.0.0"
        />,
      )

      // Find the overlay (first div child with backdrop)
      const overlay = container.querySelector('.bg-black\\/50')
      expect(overlay).toBeTruthy()

      fireEvent.click(overlay!)

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1)
      })
    })

    it('should not be visible when isOpen is false', () => {
      const onClose = vi.fn()

      const { container } = render(
        <MobileMenu
          isOpen={false}
          onClose={onClose}
          data={mockHeaderData}
          user={mockUser}
          isAuthLoading={false}
          version="1.0.0"
        />,
      )

      // Overlay should have pointer-events-none
      const overlay = container.querySelector('.pointer-events-none')
      expect(overlay).toBeTruthy()

      // Menu panel should be translated off-screen
      const menuPanel = container.querySelector('.translate-x-full')
      expect(menuPanel).toBeTruthy()
    })
  })

  describe('MobileMenuButton', () => {
    it('should call onClick when button is clicked', () => {
      const onClick = vi.fn()

      render(<MobileMenuButton onClick={onClick} />)

      const button = screen.getByLabelText('Open menu')
      expect(button.getAttribute('type')).toBe('button')
      
      fireEvent.click(button)

      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })
})
