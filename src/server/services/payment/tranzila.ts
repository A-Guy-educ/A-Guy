/**
 * Tranzila Payment Gateway Service
 *
 * @fileType service
 * @domain payments
 * @ai-summary Tranzila gateway integration for hosted redirect payments
 */

export interface TranzilaConfig {
  terminal: string
  apiKey: string
  supplier: string
  callbackSecret: string
  appUrl: string
}

export interface BuildPaymentUrlParams {
  pricingPlanId: string
  userId: string
  orderId: string
  amount: number
  currency: string
  productName: string
  successUrl: string
  cancelUrl: string
  failureUrl: string
}

export interface TranzilaCallback {
  TXnID: string
  OrderId: string
  Status: 'approved' | 'failed' | string
  Amount: string
  Currency: string
  CCNative: string
  Brand: string
  Total: string
  IntIs: string
  ExIs: string
  [key: string]: string
}

function getConfig(): TranzilaConfig {
  const terminal = process.env.TRANZILA_TERMINAL
  const apiKey = process.env.TRANZILA_API_KEY
  const supplier = process.env.TRANZILA_SUPPLIER
  const callbackSecret = process.env.TRANZILA_CALLBACK_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!terminal || !apiKey || !supplier || !callbackSecret || !appUrl) {
    throw new Error('Missing Tranzila environment variables')
  }

  return { terminal, apiKey, supplier, callbackSecret, appUrl }
}

/**
 * Build Tranzila hosted payment URL
 */
export function buildPaymentUrl(params: BuildPaymentUrlParams): string {
  const config = getConfig()

  const url = new URL('https://secure.tranzila.com/cgi-bin/tranzila71u.cgi')

  url.searchParams.set('terminal', config.terminal)
  url.searchParams.set('supplier', config.supplier)
  url.searchParams.set('orderid', params.orderId)
  url.searchParams.set('sum', params.amount.toString())
  url.searchParams.set('currency', params.currency)
  url.searchParams.set('coin1', params.userId) // Pass userId in coin1 field
  url.searchParams.set('product_name', params.productName)
  url.searchParams.set('lang', 'il') // Hebrew interface

  // Redirect URLs
  url.searchParams.set('success_url', params.successUrl)
  url.searchParams.set('cancel_url', params.cancelUrl)
  url.searchParams.set('failure_url', params.failureUrl)

  return url.toString()
}

/**
 * Parse Tranzila callback parameters
 */
export function parseCallback(params: URLSearchParams): TranzilaCallback {
  const data: TranzilaCallback = {
    TXnID: params.get('TXnID') || '',
    OrderId: params.get('OrderId') || '',
    Status: params.get('Status') || '',
    Amount: params.get('Amount') || '',
    Currency: params.get('Currency') || '',
    CCNative: params.get('CCNative') || '',
    Brand: params.get('Brand') || '',
    Total: params.get('Total') || '',
    IntIs: params.get('IntIs') || '',
    ExIs: params.get('ExIs') || '',
  }

  // Copy all remaining params
  params.forEach((value, key) => {
    if (!(key in data)) {
      data[key] = value
    }
  })

  return data
}

/**
 * Verify Tranzila callback HMAC signature
 * Tranzila uses HMAC-SHA256 verification with the callback secret
 */
export async function verifyCallback(params: URLSearchParams, secret: string): Promise<boolean> {
  const receivedHmac = params.get('HMAC')

  if (!receivedHmac) {
    return false
  }

  // Build the string to verify from specific fields
  const txId = params.get('TXnID') || ''
  const orderId = params.get('OrderId') || ''
  const status = params.get('Status') || ''
  const amount = params.get('Amount') || ''
  const currency = params.get('Currency') || ''

  const dataString = `${txId}|${orderId}|${status}|${amount}|${currency}`

  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(dataString)

  // Use Web Crypto API for HMAC-SHA256
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const signature = await crypto.subtle.verify(
    'HMAC',
    cryptoKey,
    Uint8Array.from(atob(receivedHmac), (c) => c.charCodeAt(0)),
    messageData,
  )

  return signature
}

/**
 * Get the appropriate success/cancel/failure URLs for Tranzila redirect
 */
export function getRedirectUrls(orderId: string): {
  successUrl: string
  cancelUrl: string
  failureUrl: string
} {
  const config = getConfig()
  const base = config.appUrl

  return {
    successUrl: `${base}/payment/success?orderId=${orderId}`,
    cancelUrl: `${base}/payment/cancel?orderId=${orderId}`,
    failureUrl: `${base}/payment/failure?orderId=${orderId}`,
  }
}
