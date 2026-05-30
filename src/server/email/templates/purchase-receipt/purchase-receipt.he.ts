/**
 * Purchase Receipt Email Template — Hebrew
 *
 * @fileType email-template
 * @domain email
 * @pattern purchase-receipt
 * @ai-summary Hebrew purchase receipt email sent to users after successful payment
 */

import type { PurchaseReceiptData } from './purchase-receipt.en'

function formatAmount(amount: number, currency: string): string {
  const symbols: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€' }
  const symbol = symbols[currency] ?? currency
  const formatted = (amount / 100).toFixed(2)
  return `${formatted}${symbol}`
}

/**
 * Hebrew purchase receipt email body.
 * Returns a standalone HTML document string compatible with all major email clients.
 */
export function buildPurchaseReceiptEmailHE(data: PurchaseReceiptData): string {
  const {
    productName,
    amount,
    currency,
    transactionId,
    paymentDate,
    purchaseLink,
    couponCode,
    couponDiscount,
    originalAmount,
  } = data

  const originalAmountRow =
    originalAmount !== undefined
      ? `<tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">סכום מקורי</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px; text-align: left; text-decoration: line-through;">${formatAmount(originalAmount, currency)}</td>
        </tr>`
      : ''

  const couponRows = couponCode
    ? `<tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">קופון שומש</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: left;">${couponCode}${couponDiscount ? `<span style="color: #16a34a; margin-right: 8px; font-weight: bold;">(${couponDiscount} הנחה)</span>` : ''}</td>
        </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charSet="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>אישור רכישה — ${productName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
  <table width="100%" cellPadding="0" cellSpacing="0" style="background-color: #f5f5f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellPadding="0" cellSpacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color: #2563eb; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">הרכישה אושרה!</h1>
              <p style="margin: 8px 0 0; color: #dbeafe; font-size: 14px;">תודה על הרכישה</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px; color: #111827; font-size: 20px; font-weight: bold;">${productName}</h2>
              <table width="100%" cellPadding="0" cellSpacing="0" style="margin-bottom: 24px;">
                <tbody>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">מספר עסקה</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: left; font-family: monospace;">${transactionId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">תאריך התשלום</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: left;">${paymentDate}</td>
                  </tr>
                  ${originalAmountRow}
                  ${couponRows}
                  <tr>
                    <td style="padding: 12px 0; color: #6b7280; font-size: 14px; font-weight: bold;">סכום ששולם</td>
                    <td style="padding: 12px 0; color: #111827; font-size: 20px; font-weight: bold; text-align: left;">${formatAmount(amount, currency)}</td>
                  </tr>
                </tbody>
              </table>
              <table width="100%" cellPadding="0" cellSpacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <a href="${purchaseLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">הרכישות שלי</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">אם יש לך שאלות לגבי הרכישה, אנא פנה לצוות התמיכה שלנו. דוא&quot;ל זה מאשר תשלום מוצלח. לא נדרשת פעולה מצדך.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">A-Guy — המורה הדיגיטלי שלך למתמטיקה</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
