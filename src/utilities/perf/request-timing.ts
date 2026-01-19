import type { Logger } from 'pino'

const DEFAULT_SLOW_MS = 1000
const DEFAULT_IDLE_MS = 5 * 60 * 1000
const DEFAULT_SLOW_QUERY_MS = 200

let hasFirstRequest = false
let lastRequestAtMs: number | null = null

export type TimingBreakdown = Record<string, number>

interface RequestTimingOptions {
  requestId: string
  endpoint: string
  logger: Logger
  slowMs?: number
  idleMs?: number
}

interface SlowQueryLogParams {
  requestId: string
  endpoint: string
  collection: string
  filterKeys: string[]
  limit?: number
  sort?: string
  durationMs: number
  logger: Logger
}

export class RequestTiming {
  private startedAtMs: number
  private breakdown: TimingBreakdown = {}
  private stageStarts = new Map<string, number>()
  private finished = false
  private readonly options: RequestTimingOptions
  readonly isColdStart: boolean

  constructor(options: RequestTimingOptions) {
    this.options = options
    this.startedAtMs = Date.now()

    const now = this.startedAtMs
    const idleMs = options.idleMs ?? DEFAULT_IDLE_MS
    const isFirst = !hasFirstRequest
    const isIdle = lastRequestAtMs ? now - lastRequestAtMs > idleMs : false
    this.isColdStart = isFirst || isIdle
  }

  markPoint(name: string) {
    if (!this.breakdown[name]) {
      this.breakdown[name] = 0
    }
  }

  start(name: string) {
    this.stageStarts.set(name, Date.now())
  }

  end(name: string) {
    const start = this.stageStarts.get(name)
    if (start === undefined) return 0
    const durationMs = Date.now() - start
    this.breakdown[name] = durationMs
    this.stageStarts.delete(name)
    return durationMs
  }

  recordDuration(name: string, durationMs: number) {
    this.breakdown[name] = durationMs
  }

  async time<T>(name: string, fn: () => Promise<T>) {
    const start = Date.now()
    try {
      const result = await fn()
      const durationMs = Date.now() - start
      this.breakdown[name] = durationMs
      return { result, durationMs }
    } catch (error) {
      const durationMs = Date.now() - start
      this.breakdown[name] = durationMs
      throw error
    }
  }

  timeSync<T>(name: string, fn: () => T) {
    const start = Date.now()
    const result = fn()
    const durationMs = Date.now() - start
    this.breakdown[name] = durationMs
    return { result, durationMs }
  }

  finish() {
    if (this.finished) {
      return { totalMs: Date.now() - this.startedAtMs, breakdown: this.breakdown }
    }
    this.finished = true
    const totalMs = Date.now() - this.startedAtMs
    lastRequestAtMs = Date.now()
    hasFirstRequest = true
    return { totalMs, breakdown: this.breakdown }
  }

  logIfSlow() {
    const { totalMs, breakdown } = this.finish()
    const slowMs = this.options.slowMs ?? DEFAULT_SLOW_MS

    if (totalMs > slowMs) {
      this.options.logger.info(
        {
          requestId: this.options.requestId,
          endpoint: this.options.endpoint,
          totalMs,
          breakdown,
          isColdStart: this.isColdStart,
        },
        'Slow request timing',
      )
    }

    return { totalMs, breakdown }
  }
}

export function getFilterShapeKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => getFilterShapeKeys(item, `${prefix}[${index}]`))
  }

  const obj = value as Record<string, unknown>
  return Object.keys(obj).flatMap((key) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key
    const nested = getFilterShapeKeys(obj[key], nextPrefix)
    return nested.length > 0 ? nested : [nextPrefix]
  })
}

export async function timeDbOperation<T>(
  timing: RequestTiming,
  params: {
    stage: string
    collection: string
    filterKeys: string[]
    limit?: number
    sort?: string
    logger: Logger
    requestId: string
    endpoint: string
  },
  fn: () => Promise<T>,
): Promise<T> {
  const { result, durationMs } = await timing.time(params.stage, fn)

  if (durationMs > DEFAULT_SLOW_QUERY_MS) {
    const logParams: SlowQueryLogParams = {
      requestId: params.requestId,
      endpoint: params.endpoint,
      collection: params.collection,
      filterKeys: params.filterKeys,
      limit: params.limit,
      sort: params.sort,
      durationMs,
      logger: params.logger,
    }
    logParams.logger.info(
      {
        requestId: logParams.requestId,
        endpoint: logParams.endpoint,
        collection: logParams.collection,
        filterKeys: logParams.filterKeys,
        limit: logParams.limit,
        sort: logParams.sort,
        durationMs: logParams.durationMs,
      },
      'Slow db query',
    )
  }

  return result
}
