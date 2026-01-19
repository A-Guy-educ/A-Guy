import { setTimeout as delay } from 'timers/promises'

const endpointUrl = process.env.ENDPOINT_URL ?? ''
if (!endpointUrl) {
  console.error('ENDPOINT_URL is required')
  process.exit(1)
}

const count = Number(process.env.COUNT ?? '25')
const method = process.env.METHOD ?? 'GET'
const pauseMs = Number(process.env.PAUSE_MS ?? '0')

const headers: Record<string, string> = {}

if (process.env.AUTH_TOKEN) {
  headers.authorization = `Bearer ${process.env.AUTH_TOKEN}`
}

if (process.env.AUTH_HEADER && process.env.AUTH_HEADER_VALUE) {
  headers[process.env.AUTH_HEADER] = process.env.AUTH_HEADER_VALUE
}

let body: string | undefined
if (process.env.BODY) {
  body = process.env.BODY
  headers['content-type'] = 'application/json'
}

async function run() {
  for (let i = 1; i <= count; i += 1) {
    const start = Date.now()
    const response = await fetch(endpointUrl, {
      method,
      headers,
      body,
    })
    const durationMs = Date.now() - start
    console.log(`[${i}/${count}] ${method} ${endpointUrl} -> ${response.status} (${durationMs}ms)`)
    if (pauseMs > 0) {
      await delay(pauseMs)
    }
  }
}

run().catch((error) => {
  console.error('Repro script failed:', error)
  process.exit(1)
})
