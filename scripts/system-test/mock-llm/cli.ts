/**
 * @fileType utility
 * @domain cody | system-test | mock-llm
 * @ai-summary CLI entry point for the LLM mock tool
 */

import { createServer, type MockServer } from './server.js'
import { createReplayer, type Replayer } from './replayer.js'
import { createRecorder, type Recorder } from './recorder.js'
import type { MockLLMConfig, Mode } from './types.js'

interface ParsedArgs {
  mode: Mode
  port: number
  recordingsDir: string
  upstreamUrl?: string
  apiKey?: string
  timeout?: number
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2)
  const result: ParsedArgs = {
    mode: 'replay',
    port: 8080,
    recordingsDir: '',
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]

    switch (arg) {
      case '--mode':
        if (!nextArg || (nextArg !== 'record' && nextArg !== 'replay')) {
          console.error('Error: --mode must be "record" or "replay"')
          process.exit(1)
        }
        result.mode = nextArg
        i++
        break

      case '--port':
        const port = parseInt(nextArg || '', 10)
        if (isNaN(port) || port < 1 || port > 65535) {
          console.error('Error: --port must be a valid port number')
          process.exit(1)
        }
        result.port = port
        i++
        break

      case '--recordings-dir':
        if (!nextArg) {
          console.error('Error: --recordings-dir requires a path')
          process.exit(1)
        }
        result.recordingsDir = nextArg
        i++
        break

      case '--upstream':
        if (!nextArg) {
          console.error('Error: --upstream requires a URL')
          process.exit(1)
        }
        result.upstreamUrl = nextArg
        i++
        break

      case '--api-key':
        if (!nextArg) {
          console.error('Error: --api-key requires a key')
          process.exit(1)
        }
        result.apiKey = nextArg
        i++
        break

      case '--timeout':
        const timeout = parseInt(nextArg || '', 10)
        if (isNaN(timeout) || timeout < 0) {
          console.error('Error: --timeout must be a positive number')
          process.exit(1)
        }
        result.timeout = timeout
        i++
        break

      case '--help':
      case '-h':
        printUsage()
        process.exit(0)
        break

      default:
        console.error(`Error: Unknown argument: ${arg}`)
        printUsage()
        process.exit(1)
    }
  }

  // Validate required arguments
  if (!result.recordingsDir) {
    console.error('Error: --recordings-dir is required')
    process.exit(1)
  }

  if (result.mode === 'record' && !result.upstreamUrl) {
    console.error('Error: --upstream is required for record mode')
    process.exit(1)
  }

  // Get API key from env if not provided
  if (result.mode === 'record' && !result.apiKey) {
    result.apiKey = process.env.LLM_API_KEY || process.env.GROQ_API_KEY || ''
    if (!result.apiKey) {
      console.error('Error: API key required. Set LLM_API_KEY, GROQ_API_KEY, or pass --api-key')
      process.exit(1)
    }
  }

  return result
}

function printUsage(): void {
  console.log(`
Usage:
  pnpm tsx scripts/system-test/mock-llm/cli.ts [options]

Options:
  --mode <record|replay>     Mode of operation (required)
  --port <number>            Port to listen on (default: 8080)
  --recordings-dir <path>    Directory for recordings (required)
  --upstream <url>           Upstream LLM API URL (required for record mode)
  --api-key <key>            API key for upstream (record mode, or use LLM_API_KEY env)
  --timeout <ms>             Upstream timeout in ms (default: 120000)
  --help, -h                 Show this help message

Examples:
  # Record a new scenario
  pnpm tsx scripts/system-test/mock-llm/cli.ts \\
    --mode record \\
    --port 8080 \\
    --recordings-dir scripts/system-test/recordings/scenario-02 \\
    --upstream https://api.groq.com/openai \\
    --api-key $GROQ_API_KEY

  # Replay a recorded scenario
  pnpm tsx scripts/system-test/mock-llm/cli.ts \\
    --mode replay \\
    --port 8080 \\
    --recordings-dir scripts/system-test/recordings/scenario-02
`)
}

async function main(): Promise<void> {
  const args = parseArgs()

  let server: MockServer
  let replayer: Replayer | undefined
  let recorder: Recorder | undefined

  const config: MockLLMConfig = {
    mode: args.mode,
    port: args.port,
    recordingsDir: args.recordingsDir,
    upstreamUrl: args.upstreamUrl,
    apiKey: args.apiKey,
    timeout: args.timeout,
  }

  if (args.mode === 'replay') {
    replayer = createReplayer({ recordingsDir: args.recordingsDir })
    server = createServer({ config, replayer })
  } else {
    recorder = createRecorder({
      recordingsDir: args.recordingsDir,
      upstreamUrl: args.upstreamUrl!,
      apiKey: args.apiKey!,
      timeout: args.timeout,
    })
    server = createServer({ config, recorder })
  }

  // Handle graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[mock-llm] Received ${signal}, shutting down...`)

    if (recorder) {
      await recorder.shutdown()
    }

    await server.stop()
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  try {
    await server.start()
  } catch (err) {
    console.error(`[mock-llm] Failed to start: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
}

main()
