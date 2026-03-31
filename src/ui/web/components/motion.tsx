'use client'

import { motion, type Variants, type BezierDefinition } from 'framer-motion'
import React from 'react'

const easeOut: BezierDefinition = [0.25, 0.46, 0.45, 0.94]

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
}

export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUpVariants}
      transition={{ duration: 0.4, ease: easeOut, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      variants={fadeUpVariants}
      transition={{ duration: 0.4, ease: easeOut }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
