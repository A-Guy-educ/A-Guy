import React from 'react'
import { Input } from '@/ui/web/components/input'
import { Label } from '@/ui/web/components/label'
import './SignupFormFields.css'

interface SignupFormFieldsProps {
  t: (key: string) => string
  isLoading: boolean
  errors: Record<string, string>
}

export function SignupFormFields({ t, isLoading, errors }: SignupFormFieldsProps) {
  return (
    <>
      {/* Honeypot field - invisible to users, catches bots */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="honeypot-field"
        aria-hidden="true"
      />

      <div className="space-y-2">
        <Label htmlFor="name">{t('name')}</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder={t('namePlaceholder')}
          required
          disabled={isLoading}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && <p className="text-body-sm text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder={t('emailPlaceholder')}
          required
          disabled={isLoading}
          className={errors.email ? 'border-destructive' : ''}
        />
        {errors.email && <p className="text-body-sm text-destructive">{errors.email}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder={t('passwordPlaceholder')}
          required
          disabled={isLoading}
          className={errors.password ? 'border-destructive' : ''}
        />
        {errors.password && <p className="text-body-sm text-destructive">{errors.password}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder={t('passwordPlaceholder')}
          required
          disabled={isLoading}
          className={errors.confirmPassword ? 'border-destructive' : ''}
        />
        {errors.confirmPassword && (
          <p className="text-body-sm text-destructive">{errors.confirmPassword}</p>
        )}
      </div>

      {/* Generic error banner */}
      {errors.general && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-body-sm text-destructive">{errors.general}</p>
        </div>
      )}
    </>
  )
}
