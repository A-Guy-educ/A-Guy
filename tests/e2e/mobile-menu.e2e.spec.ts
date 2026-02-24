import { test, expect } from '@playwright/test'

test.describe('Mobile Menu', () => {
  test('opens and closes mobile menu on homepage', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Navigate to homepage
    await page.goto('/')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Verify hamburger menu is visible
    const hamburger = page.getByRole('button', { name: /open menu/i })
    await expect(hamburger).toBeVisible()
    
    // Click hamburger to open menu
    await hamburger.click()
    
    // Wait for menu to be visible with proper class
    await page.waitForSelector('[data-testid="mobile-menu-panel"]:not([class*="pointer-events-none"])', { 
      state: 'visible'
    })
    
    // Verify menu is open
    const menuPanel = page.getByTestId('mobile-menu-panel')
    await expect(menuPanel).toBeVisible()
    await expect(menuPanel).toHaveClass(/translate-x-0/)
    
    // Verify close button is visible
    const closeButton = page.getByRole('button', { name: /close menu/i })
    await expect(closeButton).toBeVisible()
    
    // Click close button
    await closeButton.click()
    
    // Wait for menu to have the closed class
    await page.waitForSelector('[data-testid="mobile-menu-panel"][class*="pointer-events-none"]')
    
    // Verify menu is closed - the panel should not be visible anymore
    const closedPanel = page.getByTestId('mobile-menu-panel')
    await expect(closedPanel).toHaveClass(/translate-x-full/)
    
    // Verify overlay is not blocking clicks
    const overlay = page.getByTestId('mobile-menu-overlay')
    await expect(overlay).toHaveClass(/pointer-events-none/)
  })
  
  test('closes mobile menu when clicking overlay', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Navigate to homepage
    await page.goto('/')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Open menu
    const hamburger = page.getByRole('button', { name: /open menu/i })
    await hamburger.click()
    
    // Wait for menu to be visible
    await page.waitForSelector('[data-testid="mobile-menu-panel"]:not([class*="pointer-events-none"])', { 
      state: 'visible'
    })
    
    // Verify menu is open
    const menuPanel = page.getByTestId('mobile-menu-panel')
    await expect(menuPanel).toBeVisible()
    await expect(menuPanel).toHaveClass(/translate-x-0/)
    
    // Click overlay (outside the menu)
    const overlay = page.getByTestId('mobile-menu-overlay')
    await overlay.click({ position: { x: 10, y: 10 } })
    
    // Wait for menu to have the closed class
    await page.waitForSelector('[data-testid="mobile-menu-panel"][class*="pointer-events-none"]')
    
    // Verify menu is closed
    const closedPanel = page.getByTestId('mobile-menu-panel')
    await expect(closedPanel).toHaveClass(/translate-x-full/)
  })
  
  test('mobile menu close button has correct attributes', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Navigate to homepage
    await page.goto('/')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Open menu
    const hamburger = page.getByRole('button', { name: /open menu/i })
    await hamburger.click()
    
    // Wait for menu to be visible
    await page.waitForSelector('[data-testid="mobile-menu-panel"]:not([class*="pointer-events-none"])', { 
      state: 'visible'
    })
    
    // Check close button attributes
    const closeButton = page.getByRole('button', { name: /close menu/i })
    await expect(closeButton).toBeVisible()
    await expect(closeButton).toHaveAttribute('type', 'button')
    await expect(closeButton).toHaveAttribute('aria-label', 'Close menu')
  })
})
