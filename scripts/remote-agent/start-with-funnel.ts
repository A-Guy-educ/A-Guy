/**
 * @fileType utility
 * @domain remote-agent
 * @pattern tunnel-script
 * @ai-summary Starts the remote agent and exposes it via Tailscale Funnel
 */

import 'dotenv/config'
import { execSync, spawn } from 'child_process'
import { REMOTE_AGENT_PORT } from './config'

function isPortInUse(port: number): boolean {
  try {
    execSync(`lsof -i :${port} -sTCP:LISTEN`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function start(): Promise<void> {
  if (!process.env.REMOTE_AGENT_KEY) {
    console.error('❌ REMOTE_AGENT_KEY is not set. Set it in your .env file.')
    process.exit(1)
  }

  console.log(`🤖 Starting Remote Dev Agent with Tailscale Funnel`)
  console.log(`   Port: ${REMOTE_AGENT_PORT}`)
  console.log('')

  // Start the agent server if not already running
  if (!isPortInUse(REMOTE_AGENT_PORT)) {
    console.log(`🚀 Starting remote agent on port ${REMOTE_AGENT_PORT}...`)
    const agentProc = spawn('tsx', ['scripts/remote-agent/server.ts'], {
      stdio: 'inherit',
      detached: true,
      env: { ...process.env },
    })
    agentProc.unref()
    // Wait for server to boot
    await new Promise<void>((resolve) => setTimeout(resolve, 2000))
  } else {
    console.log(`✅ Remote agent already running on port ${REMOTE_AGENT_PORT}`)
  }

  // Start Tailscale Funnel
  console.log(`🌐 Starting Tailscale Funnel on port ${REMOTE_AGENT_PORT}...`)
  console.log(`   Note: Requires 'tailscale funnel' to be enabled on this device.`)
  console.log('')

  const funnel = spawn('tailscale', ['funnel', '--bg', String(REMOTE_AGENT_PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const handleOutput = (data: Buffer) => {
    const line = data.toString().trim()
    if (line) {
      // Look for the URL in tailscale output
      const urlMatch = line.match(/https:\/\/[^\s]+/)
      if (urlMatch) {
        console.log(`✅ Funnel URL: ${urlMatch[0]}`)
        console.log('')
        console.log(`   Set in Vercel env: REMOTE_DEV_USERS=<gh_username>:<key>:${urlMatch[0]}`)
        console.log('')
      } else {
        console.log(`   ${line}`)
      }
    }
  }

  funnel.stdout.on('data', handleOutput)
  funnel.stderr.on('data', handleOutput)

  funnel.on('close', (code: number | null) => {
    if (code === 0) {
      console.log('✅ Tailscale Funnel started in background')
      console.log(`   Run 'tailscale funnel status' to see the URL`)
    } else {
      console.error(`❌ Tailscale Funnel exited with code ${code}`)
      process.exit(code ?? 1)
    }
  })

  funnel.on('error', (err: Error) => {
    console.error('❌ Failed to start Tailscale Funnel:', err.message)
    console.error('   Make sure Tailscale is installed and you are logged in.')
    process.exit(1)
  })

  const shutdown = () => {
    console.log('\n🛑 Stopping Tailscale Funnel...')
    try {
      execSync(`tailscale funnel --bg --off ${REMOTE_AGENT_PORT}`, { stdio: 'ignore' })
    } catch {
      // Ignore errors
    }
    funnel.kill()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

start()
