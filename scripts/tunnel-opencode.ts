import 'dotenv/config'
import { execSync, spawn } from 'child_process'
import localtunnel from 'localtunnel'

const PORT = 3003
const SUBDOMAIN = process.env.LT_SUBDOMAIN || undefined
const PASSWORD = process.env.OPENCODE_SERVER_PASSWORD

console.log(`🚀 Starting OpenCode tunnel on port ${PORT}`)
if (SUBDOMAIN) {
  console.log(`🌐 Requested subdomain: ${SUBDOMAIN}`)
}
if (PASSWORD) {
  console.log(`🔒 Password: ${PASSWORD}`)
}
console.log('')

export function isPortInUse(port: number): boolean {
  try {
    execSync(`lsof -i :${port} -sTCP:LISTEN`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function start(): Promise<void> {
  if (!isPortInUse(PORT)) {
    console.log(`⚠️  Starting OpenCode on port ${PORT}...`)
    spawn('opencode', ['web', '--port', String(PORT)], {
      stdio: 'inherit',
      detached: true,
    }).unref()
    await new Promise<void>((resolve) => setTimeout(resolve, 5000))
  } else {
    console.log(`✅ OpenCode already running on port ${PORT}`)
  }

  const tunnel = await localtunnel({ port: PORT, subdomain: SUBDOMAIN })

  console.log(`🌐 Tunnel URL: ${tunnel.url}`)
  if (PASSWORD) {
    console.log(`🔒 Password: ${PASSWORD}`)
  }
  console.log('')
  console.log('Press Ctrl+C to stop the tunnel.')

  tunnel.on('close', () => {
    console.log('🔌 Tunnel closed')
    process.exit(0)
  })

  tunnel.on('error', (err: Error) => {
    console.error('❌ Tunnel error:', err)
    process.exit(1)
  })

  const shutdown = () => {
    console.log('\n🛑 Shutting down tunnel...')
    tunnel.close()
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

start()
