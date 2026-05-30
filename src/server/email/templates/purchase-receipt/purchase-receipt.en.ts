/**
 * Purchase Receipt Email Template — English
 *
 * @fileType email-template
 * @domain email
 * @pattern purchase-receipt
 * @ai-summary English purchase receipt email sent to users after successful payment
 */

export interface PurchaseReceiptData {
  productName: string
  amount: number
  currency: string
  transactionId: string
  paymentDate: string
  purchaseLink: string
  couponCode?: string
  couponDiscount?: string
  originalAmount?: number
}

function formatAmount(amount: number, currency: string): string {
  const symbols: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€' }
  const symbol = symbols[currency] ?? currency
  const formatted = (amount / 100).toFixed(2)
  return `${symbol}${formatted}`
}

/**
 * English purchase receipt email body.
 * Returns a standalone HTML document string compatible with all major email clients.
 */
export function buildPurchaseReceiptEmailEN(data: PurchaseReceiptData): string {
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
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Original Amount</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px; text-align: right; text-decoration: line-through;">${formatAmount(originalAmount, currency)}</td>
        </tr>`
      : ''

  const couponRows = couponCode
    ? `<tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Coupon Applied</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right;">${couponCode}${couponDiscount ? `<span style="color: #16a34a; margin-left: 8px; font-weight: bold;">(${couponDiscount} off)</span>` : ''}</td>
        </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Purchase Confirmation — ${productName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
  <table width="100%" cellPadding="0" cellSpacing="0" style="background-color: #f5f5f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellPadding="0" cellSpacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color: #2563eb; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Purchase Confirmed!</h1>
              <p style="margin: 8px 0 0; color: #dbeafe; font-size: 14px;">Thank you for your purchase</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px; color: #111827; font-size: 20px; font-weight: bold;">${productName}</h2>
              <table width="100%" cellPadding="0" cellSpacing="0" style="margin-bottom: 24px;">
                <tbody>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Transaction ID</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right; font-family: monospace;">${transactionId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Payment Date</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right;">${paymentDate}</td>
                  </tr>
                  ${originalAmountRow}
                  ${couponRows}
                  <tr>
                    <td style="padding: 12px 0; color: #6b7280; font-size: 14px; font-weight: bold;">Amount Paid</td>
                    <td style="padding: 12px 0; color: #111827; font-size: 20px; font-weight: bold; text-align: right;">${formatAmount(amount, currency)}</td>
                  </tr>
                </tbody>
              </table>
              <table width="100%" cellPadding="0" cellSpacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <a href="${purchaseLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">View My Purchases</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">If you have any questions about your purchase, please contact our support team. This email confirms a successful payment. No action is required on your part.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">A-Guy — Your Digital Math Teacher</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
