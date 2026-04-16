import tailwindcssAnimate from 'tailwindcss-animate'
import typography from '@tailwindcss/typography'
import designTokens from './tailwind.tokens.mjs'

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  plugins: [tailwindcssAnimate, typography],
  prefix: '',
  safelist: [
    'lg:col-span-4',
    'lg:col-span-6',
    'lg:col-span-8',
    'lg:col-span-12',
    'border-border',
    'bg-card',
    'border-error',
    'bg-error/30',
    'border-success',
    'bg-success/30',
    'border-warning',
    'bg-warning/30',
    'my-0',
    'my-4',
    'my-8',
    'my-16',
    'my-24',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        '2xl': '2rem',
        DEFAULT: '1rem',
        lg: '2rem',
        md: '2rem',
        sm: '1rem',
        xl: '2rem',
      },
      screens: {
        '2xl': '86rem',
        lg: '64rem',
        md: '48rem',
        sm: '40rem',
        xl: '80rem',
      },
    },
    extend: {
      // Design tokens
      spacing: designTokens.spacing,
      boxShadow: designTokens.boxShadow,
      zIndex: designTokens.zIndex,
      fontSize: designTokens.fontSize,
      transitionDuration: designTokens.transitionDuration,
      borderWidth: designTokens.borderWidth,
      opacity: designTokens.opacity,
      borderRadius: {
        ...designTokens.borderRadius,
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
      },
      iconSize: designTokens.iconSize,
      inputHeight: designTokens.inputHeight,
      chatText: designTokens.chatText,
      letterSpacing: designTokens.letterSpacing,
      maxWidth: designTokens.maxWidth,

      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        // Cody dashboard v2 animations
        'cody-pulse': 'cody-pulse 2s ease-in-out infinite',
        'cody-leading-edge': 'cody-leading-edge 1.5s ease-in-out infinite',
        'cody-shimmer': 'cody-shimmer 2s ease-in-out infinite',
        'cody-breathe': 'cody-breathe 3s ease-in-out infinite',
        'cody-breathe-overlay': 'cody-breathe-overlay 3s ease-in-out infinite',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-subtle':
          'linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--accent) / 0.05))',
      },
      colors: {
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        background: 'hsl(var(--background))',
        border: 'hsl(var(--border))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        foreground: 'hsl(var(--foreground))',
        input: 'hsl(var(--input))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          soft: 'hsl(var(--primary-soft))',
        },
        ring: 'hsl(var(--ring))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        error: {
          DEFAULT: 'hsl(var(--error))',
          foreground: 'hsl(var(--error-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        header: {
          DEFAULT: 'hsl(var(--header-bg))',
          foreground: 'hsl(var(--header-fg))',
        },
        footer: 'hsl(var(--footer-bg))',
        hover: 'hsl(var(--hover-bg))',
        selected: {
          DEFAULT: 'hsl(var(--selected-bg))',
          foreground: 'hsl(var(--selected-fg))',
        },
        form: {
          DEFAULT: 'hsl(var(--form-bg))',
          border: 'hsla(var(--form-border))',
          placeholder: 'hsl(var(--form-placeholder))',
        },
        elevated: {
          DEFAULT: 'hsl(var(--surface-elevated))',
          foreground: 'hsl(var(--surface-elevated-fg))',
        },
      },
      fontFamily: {
        mono: ['var(--font-geist-mono)'],
        sans: ['var(--font-geist-sans)'],
        serif: ['var(--font-stix-two-text)', 'serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
        // Cody dashboard v2 animation keyframes
        'cody-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'cody-leading-edge': {
          '0%': { opacity: '0.3', transform: 'translateX(-100%)' },
          '50%': { opacity: '0.8', transform: 'translateX(200%)' },
          '100%': { opacity: '0.3', transform: 'translateX(500%)' },
        },
        'cody-shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        'cody-breathe': {
          '0%, 100%': { opacity: '0.8' },
          '50%': { opacity: '1' },
        },
        'cody-breathe-overlay': {
          '0%, 100%': { opacity: '0.1' },
          '50%': { opacity: '0.25' },
        },
      },
      typography: () => ({
        DEFAULT: {
          css: [
            {
              '--tw-prose-body': 'var(--text)',
              '--tw-prose-headings': 'var(--text)',
              h1: {
                fontWeight: 'normal',
                marginBottom: '0.25em',
              },
            },
          ],
        },
        base: {
          css: [
            {
              h1: {
                fontSize: '2.5rem',
              },
              h2: {
                fontSize: '1.25rem',
                fontWeight: 600,
              },
            },
          ],
        },
        md: {
          css: [
            {
              h1: {
                fontSize: '3.5rem',
              },
              h2: {
                fontSize: '1.5rem',
              },
            },
          ],
        },
      }),
    },
  },
}

export default config
