'use client'

/**
 * CreateCouponModal — form modal for creating a new coupon.
 *
 * @fileType component
 * @domain admin
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from '@payloadcms/ui'

import { getCouponStrings } from '../strings'

interface CreateCouponModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface FormData {
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: string
  maxUses: string
  validFrom: string
  validUntil: string
  applicableProducts: string[]
}

const INITIAL_FORM: FormData = {
  code: '',
  discountType: 'percentage',
  discountValue: '',
  maxUses: '0',
  validFrom: '',
  validUntil: '',
  applicableProducts: [],
}

export const CreateCouponModal: React.FC<CreateCouponModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const { i18n } = useTranslation()
  const s = getCouponStrings(i18n.language)

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setForm(INITIAL_FORM)
      setError(null)
      setFieldErrors({})
    }
  }, [isOpen])

  // Client-side validation
  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (!form.code.trim()) {
      errors.code = s.couponCodeRequired
    } else if (form.code.trim().length < 3) {
      errors.code = s.couponCodeMinLength
    }

    const value = parseFloat(form.discountValue)
    if (isNaN(value) || value < 0) {
      errors.discountValue = s.discountValueRequired
    }

    if (form.discountType === 'percentage' && value > 100) {
      errors.discountValue = s.discountPercentageMax
    }

    if (form.validFrom && form.validUntil) {
      if (new Date(form.validFrom) > new Date(form.validUntil)) {
        errors.validUntil = s.validUntilAfterStart
      }
    }

    const maxUsesNum = parseInt(form.maxUses)
    if (isNaN(maxUsesNum) || maxUsesNum < 0) {
      errors.maxUses = s.maxUsesInvalid
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/collections/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          discountType: form.discountType,
          discountValue: parseFloat(form.discountValue),
          maxUses: parseInt(form.maxUses) || 0,
          validFrom: form.validFrom || null,
          validUntil: form.validUntil || null,
          applicableProducts: form.applicableProducts.length > 0 ? form.applicableProducts : null,
          isActive: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Check for duplicate code error
        if (
          data.errors?.some(
            (e: { field?: string; message?: string }) =>
              e.field === 'code' || (e.message && e.message.toLowerCase().includes('duplicate')),
          )
        ) {
          setFieldErrors((prev) => ({ ...prev, code: s.couponCodeExists }))
          return
        }
        throw new Error(data.message || data.error || s.errorCreatingCoupon)
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : s.errorCreatingCoupon)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputStyle = (fieldError?: string) => ({
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    border: `1px solid ${fieldError ? 'var(--theme-error)' : 'var(--theme-elevation-200)'}`,
    borderRadius: 4,
    backgroundColor: 'var(--theme-elevation-0)',
    color: 'var(--theme-elevation-1000)',
    marginTop: 4,
    boxSizing: 'border-box' as const,
  })

  const labelStyle = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 4,
    color: 'var(--theme-elevation-700)',
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--theme-elevation-0)',
          borderRadius: 8,
          padding: 24,
          width: '90%',
          maxWidth: 500,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 20,
            color: 'var(--theme-elevation-1000)',
          }}
        >
          {s.createNewCoupon}
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Code */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{s.couponCode}</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
              placeholder="e.g., SUMMER2024"
              style={inputStyle(fieldErrors.code)}
            />
            {fieldErrors.code && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--theme-error)',
                  marginTop: 4,
                  display: 'block',
                }}
              >
                {fieldErrors.code}
              </span>
            )}
          </div>

          {/* Discount Type & Value */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}
          >
            <div>
              <label style={labelStyle}>{s.discountType}</label>
              <select
                value={form.discountType}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    discountType: e.target.value as 'percentage' | 'fixed',
                  }))
                }
                style={inputStyle()}
              >
                <option value="percentage">{s.percentageOption}</option>
                <option value="fixed">{s.fixedAmountOption}</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>{s.discountValue}</label>
              <input
                type="number"
                value={form.discountValue}
                onChange={(e) => setForm((prev) => ({ ...prev, discountValue: e.target.value }))}
                placeholder={form.discountType === 'percentage' ? '0-100' : '₪0'}
                min="0"
                max={form.discountType === 'percentage' ? '100' : undefined}
                step={form.discountType === 'percentage' ? '1' : '0.01'}
                style={inputStyle(fieldErrors.discountValue)}
              />
              {fieldErrors.discountValue && (
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--theme-error)',
                    marginTop: 4,
                    display: 'block',
                  }}
                >
                  {fieldErrors.discountValue}
                </span>
              )}
            </div>
          </div>

          {/* Max Uses */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{s.maxUsesUnlimited}</label>
            <input
              type="number"
              value={form.maxUses}
              onChange={(e) => setForm((prev) => ({ ...prev, maxUses: e.target.value }))}
              min="0"
              style={inputStyle(fieldErrors.maxUses)}
            />
            {fieldErrors.maxUses && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--theme-error)',
                  marginTop: 4,
                  display: 'block',
                }}
              >
                {fieldErrors.maxUses}
              </span>
            )}
          </div>

          {/* Valid Dates */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}
          >
            <div>
              <label style={labelStyle}>{s.validFrom}</label>
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm((prev) => ({ ...prev, validFrom: e.target.value }))}
                style={inputStyle()}
              />
            </div>
            <div>
              <label style={labelStyle}>{s.validUntil}</label>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm((prev) => ({ ...prev, validUntil: e.target.value }))}
                style={inputStyle(fieldErrors.validUntil)}
              />
              {fieldErrors.validUntil && (
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--theme-error)',
                    marginTop: 4,
                    display: 'block',
                  }}
                >
                  {fieldErrors.validUntil}
                </span>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'var(--theme-error-100)',
                border: '1px solid var(--theme-error)',
                borderRadius: 4,
                color: 'var(--theme-error)',
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 500,
                border: '1px solid var(--theme-elevation-200)',
                borderRadius: 4,
                backgroundColor: 'var(--theme-elevation-0)',
                color: 'var(--theme-elevation-700)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {s.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '10px 24px',
                fontSize: 14,
                fontWeight: 500,
                border: 'none',
                borderRadius: 4,
                backgroundColor: 'var(--theme-elevation-1000)',
                color: 'var(--theme-elevation-0)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? s.creating : s.createCoupon}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateCouponModal
