/**
 * Localized strings for the Coupons admin components.
 *
 * Admin panel supports English + Hebrew. Selection happens at runtime via
 * `useTranslation().i18n.language` from @payloadcms/ui.
 */

interface CouponStrings {
  // CouponUsageModal
  couponUsages: string
  totalUsages: string
  firstUse: string
  lastUse: string
  user: string
  transaction: string
  date: string
  loading: string
  noUsages: string
  close: string

  // CreateCouponModal
  createNewCoupon: string
  couponCode: string
  couponCodeRequired: string
  couponCodeMinLength: string
  discountType: string
  discountValue: string
  discountValueRequired: string
  discountPercentageMax: string
  maxUses: string
  maxUsesUnlimited: string
  maxUsesInvalid: string
  validFrom: string
  validUntil: string
  validUntilAfterStart: string
  cancel: string
  creating: string
  createCoupon: string
  couponCodeExists: string
  errorCreatingCoupon: string
  percentageOption: string
  fixedAmountOption: string

  // ListView
  addCoupon: string

  // List columns (derived/computed fields)
  statusActive: string
  statusExpired: string
  statusExhausted: string
  statusInactive: string
  statusScheduled: string
  usageLabel: string
  expiresLabel: string
  expiresNever: string

  // Detail view
  usageProgress: string
  usageRemaining: string
  usageExhausted: string
}

const EN: CouponStrings = {
  // CouponUsageModal
  couponUsages: 'Coupon Usages',
  totalUsages: 'Total Usages',
  firstUse: 'First Use',
  lastUse: 'Last Use',
  user: 'User',
  transaction: 'Transaction',
  date: 'Date',
  loading: 'Loading...',
  noUsages: 'No usages yet',
  close: 'Close',

  // CreateCouponModal
  createNewCoupon: 'Create New Coupon',
  couponCode: 'Coupon Code *',
  couponCodeRequired: 'Coupon code is required',
  couponCodeMinLength: 'Coupon code must be at least 3 characters',
  discountType: 'Discount Type',
  discountValue: 'Discount Value *',
  discountValueRequired: 'Discount value must be a positive number',
  discountPercentageMax: 'Percentage discount cannot exceed 100%',
  maxUses: 'Max Uses (0 = unlimited)',
  maxUsesUnlimited: 'Max Uses (0 = unlimited)',
  maxUsesInvalid: 'Max uses must be a non-negative number',
  validFrom: 'Valid From',
  validUntil: 'Valid Until',
  validUntilAfterStart: 'End date must be after start date',
  cancel: 'Cancel',
  creating: 'Creating...',
  createCoupon: 'Create Coupon',
  couponCodeExists: 'This coupon code already exists',
  errorCreatingCoupon: 'Error creating coupon',
  percentageOption: 'Percentage',
  fixedAmountOption: 'Fixed Amount',

  // ListView
  addCoupon: 'Add Coupon',

  // List columns
  statusActive: 'Active',
  statusExpired: 'Expired',
  statusExhausted: 'Exhausted',
  statusInactive: 'Inactive',
  statusScheduled: 'Scheduled',
  usageLabel: 'Usage',
  expiresLabel: 'Expires',
  expiresNever: 'Never expires',

  // Detail view
  usageProgress: 'Usage',
  usageRemaining: 'remaining',
  usageExhausted: 'Exhausted',
}

const HE: CouponStrings = {
  // CouponUsageModal
  couponUsages: 'שימושי קופון',
  totalUsages: 'סה"כ שימושים',
  firstUse: 'שימוש ראשון',
  lastUse: 'שימוש אחרון',
  user: 'משתמש',
  transaction: 'טרנזקציה',
  date: 'תאריך',
  loading: 'טוען...',
  noUsages: 'אין שימושים עדיין',
  close: 'סגור',

  // CreateCouponModal
  createNewCoupon: 'צור קופון חדש',
  couponCode: 'קוד קופון *',
  couponCodeRequired: 'קוד הקופון נדרש',
  couponCodeMinLength: 'קוד הקופון חייב להכיל לפחות 3 תווים',
  discountType: 'סוג הנחה',
  discountValue: 'ערך הנחה *',
  discountValueRequired: 'ערך ההנחה חייב להיות מספר חיובי',
  discountPercentageMax: 'הנחה באחוזים לא יכולה לעלות על 100%',
  maxUses: 'מקסימום שימושים (0 = ללא הגבלה)',
  maxUsesUnlimited: 'מקסימום שימושים (0 = ללא הגבלה)',
  maxUsesInvalid: 'מספר שימושים חייב להיות מספר אי-שלילי',
  validFrom: 'תוקף מ',
  validUntil: 'תוקף עד',
  validUntilAfterStart: 'תאריך סיום חייב להיות אחרי תאריך התחלה',
  cancel: 'ביטול',
  creating: 'יוצר...',
  createCoupon: 'צור קופון',
  couponCodeExists: 'קוד קופון זה כבר קיים',
  errorCreatingCoupon: 'שגיאה ביצירת הקופון',
  percentageOption: 'אחוז',
  fixedAmountOption: 'סכום קבוע',

  // ListView
  addCoupon: 'הוסף קופון',

  // List columns
  statusActive: 'פעיל',
  statusExpired: 'תם תוקף',
  statusExhausted: 'נוצל',
  statusInactive: 'לא פעיל',
  statusScheduled: 'מתוזמן',
  usageLabel: 'שימוש',
  expiresLabel: 'תוקף',
  expiresNever: 'ללא הגבלה',

  // Detail view
  usageProgress: 'שימוש',
  usageRemaining: 'נותרו',
  usageExhausted: 'נוצל',
}

export function getCouponStrings(lang: string): CouponStrings {
  return lang.toLowerCase().startsWith('he') ? HE : EN
}
