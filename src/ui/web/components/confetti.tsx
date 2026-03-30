'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ConfettiPiece {
  id: number
  x: number
  color: string
  delay: number
  duration: number
  rotation: number
  size: number
}

const COLORS = [
  'hsl(217 91% 60%)', // blue
  'hsl(142 71% 45%)', // green
  'hsl(330 81% 60%)', // pink
  'hsl(25 95% 53%)', // orange
  'hsl(271 91% 65%)', // purple
  'hsl(353 73% 56%)', // primary
]

export function Confetti({ active, duration = 3000 }: { active: boolean; duration?: number }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])

  useEffect(() => {
    if (!active) {
      setPieces([])
      return
    }

    const newPieces: ConfettiPiece[] = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 2,
      rotation: Math.random() * 720 - 360,
      size: 6 + Math.random() * 8,
    }))
    setPieces(newPieces)

    const timer = setTimeout(() => setPieces([]), duration)
    return () => clearTimeout(timer)
  }, [active, duration])

  return (
    <AnimatePresence>
      {pieces.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
          {pieces.map((piece) => (
            <motion.div
              key={piece.id}
              initial={{ y: -20, x: `${piece.x}vw`, opacity: 1, rotate: 0, scale: 1 }}
              animate={{ y: '110vh', opacity: 0, rotate: piece.rotation, scale: 0.5 }}
              transition={{ duration: piece.duration, delay: piece.delay, ease: 'easeIn' }}
              style={{
                position: 'absolute',
                width: piece.size,
                height: piece.size,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                backgroundColor: piece.color,
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}
