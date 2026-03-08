import 'dotenv/config'
import { execSync, spawn } from 'child_process'

const PORT = 3003
const PASSWORD = process.env.OPENCODE_SERVER_PASSWORD

export function isPortInUse(port: number): boolean {
  try {
    execSync(`lsof -i :${port} -sTCP:LISTEN`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function start(): Promise<void> {
  console.log(`🚀 Starting OpenCode tunnel on port ${PORT}`)
  console.log('')

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

  if (PASSWORD) {
    console.log(`🔒 OpenCode credentials: opencode / ${PASSWORD}`)
  }
  console.log('')

  const cf = spawn('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const handleOutput = (data: Buffer) => {
    const line = data.toString()
    const match = line.match(/https:\/\/[^\s]+\.trycloudflare\.com/)
    if (match) {
      console.log(`🌐 Tunnel URL: ${match[0]}`)
      if (PASSWORD) {
        console.log(`🔒 OpenCode credentials: opencode / ${PASSWORD}`)
      }
      console.log('')
      console.log('Press Ctrl+C to stop the tunnel.')
    }
  }

  cf.stdout.on('data', handleOutput)
  cf.stderr.on('data', handleOutput)

  cf.on('close', (code: number | null) => {
    console.log('🔌 Tunnel closed')
    process.exit(code ?? 0)
  })

  cf.on('error', (err: Error) => {
    console.error('❌ Failed to start cloudflared:', err.message)
    process.exit(1)
  })

  const shutdown = () => {
    console.log('\n🛑 Shutting down tunnel...')
    cf.kill()
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

start()
