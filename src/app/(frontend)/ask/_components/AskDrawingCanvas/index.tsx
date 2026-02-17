'use client'

import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const CANVAS_COLORS = ['#2563eb', '#ef4444', '#000000']
const CANVAS_HEIGHT = 300

interface AskDrawingCanvasProps {
  onCheckSolution: (imageData: string) => void
}

export function AskDrawingCanvas({ onCheckSolution }: AskDrawingCanvasProps) {
  const t = useTranslations('homepage.ask')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const [isChecking, setIsChecking] = useState(false)

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = canvas.offsetWidth
    canvas.height = CANVAS_HEIGHT
    ctxRef.current = canvas.getContext('2d')
    if (ctxRef.current) {
      ctxRef.current.lineCap = 'round'
      ctxRef.current.lineWidth = 3
      ctxRef.current.strokeStyle = CANVAS_COLORS[0]
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(initCanvas, 100)
    return () => clearTimeout(timer)
  }, [initCanvas])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !ctxRef.current) return
    const pos = getPos(e)
    ctxRef.current.beginPath()
    ctxRef.current.moveTo(lastPos.current.x, lastPos.current.y)
    ctxRef.current.lineTo(pos.x, pos.y)
    ctxRef.current.stroke()
    lastPos.current = pos
  }

  const clearCanvas = () => {
    if (ctxRef.current && canvasRef.current) {
      ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
  }

  const handleCheck = () => {
    if (!canvasRef.current) return
    setIsChecking(true)
    const imageData = canvasRef.current.toDataURL('image/png')
    onCheckSolution(imageData)
    setIsChecking(false)
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true
    lastPos.current = getPos(e)
  }

  const stopDraw = () => {
    isDrawing.current = false
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl overflow-hidden border-2 border-border bg-background">
        <div className="p-3 border-b border-border bg-muted flex justify-between items-center">
          <div className="flex gap-2">
            {CANVAS_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  if (ctxRef.current) ctxRef.current.strokeStyle = c
                }}
                className={cn(
                  'w-6 h-6 rounded-full border border-border',
                  'hover:scale-110 transition-transform',
                )}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={clearCanvas}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('clearCanvas')}</span>
            </button>
            <button
              onClick={handleCheck}
              disabled={isChecking}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {isChecking ? t('checking') : t('checkSolution')}
            </button>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
          className="w-full h-[300px] cursor-crosshair touch-none bg-background"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
      </div>
    </div>
  )
}
