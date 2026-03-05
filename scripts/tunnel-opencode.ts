import 'dotenv/config'
import { execSync, spawn } from 'child_process'

const PORT = 3003
const USERNAME = process.env.NGROK_USERNAME ?? 'admin'
const PASSWORD = process.env.NGROK_PASSWORD ?? 'As121212'
const DOMAIN = process.env.NGROK_DOMAIN

if (!DOMAIN) {
  console.error('❌ NGROK_DOMAIN is not set')
  console.error('   Add to .env: NGROK_DOMAIN=your-domain.ngrok-free.dev')
  process.exit(1)
}

const domain: string = DOMAIN

console.log(`🚀 Starting OpenCode tunnel on port ${PORT}`)
console.log(`🔒 Protected with: ${USERNAME} / ********`)
console.log(`🌐 URL: https://${domain}`)
console.log('')

function isPortInUse(port: number): boolean {
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
  }

  const ngrok = spawn(
    'ngrok',
    ['http', String(PORT), '--basic-auth', `${USERNAME}:${PASSWORD}`, '--domain', domain],
    { stdio: 'inherit' },
  )

  ngrok.on('close', (code: number | null) => {
    process.exit(code ?? 0)
  })
}

start()
