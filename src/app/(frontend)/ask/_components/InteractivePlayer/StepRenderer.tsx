'use client'

import { useEffect, useRef } from 'react'
import type { InteractiveLesson } from '@/infra/llm/services/interactive-lesson/interactive-lesson-types'

interface StepRendererProps {
  lesson: InteractiveLesson
  currentStepIndex: number
}

/**
 * Renders the current step's HTML content inside a sandboxed iframe.
 * Shows all steps up to and including the current one (progressive reveal).
 */
export function StepRenderer({ lesson, currentStepIndex }: StepRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const visibleSteps = lesson.steps.slice(0, currentStepIndex + 1)
    const htmlDoc = buildStepHtml(lesson, visibleSteps)

    const blob = new Blob([htmlDoc], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    iframe.src = url

    return () => URL.revokeObjectURL(url)
  }, [lesson, currentStepIndex])

  return (
    <div className="flex-1 bg-card overflow-hidden">
      <iframe
        ref={iframeRef}
        title={lesson.title}
        className="w-full h-full border-0"
        sandbox="allow-scripts"
      />
    </div>
  )
}

function buildStepHtml(
  lesson: InteractiveLesson,
  visibleSteps: InteractiveLesson['steps'],
): string {
  const dir = lesson.locale === 'he' ? 'rtl' : 'ltr'
  const lang = lesson.locale

  const stepHtml = visibleSteps
    .map(
      (step, i) => `
      <div class="step-container ${i === visibleSteps.length - 1 ? 'step-active' : 'step-previous'}"
           data-step-id="${step.id}">
        <div class="step-header">${step.title}</div>
        ${step.htmlContent}
      </div>`,
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Rubik', system-ui, sans-serif;
      background: transparent;
      padding: 16px;
      color: hsl(0 0% 15%);
      direction: ${dir};
    }
    .step-container {
      margin-bottom: 16px;
      padding: 12px 16px;
      border-radius: 12px;
      border-inline-start: 4px solid hsl(221 83% 53%);
      background: hsl(0 0% 98%);
      transition: opacity 0.4s ease;
    }
    .step-previous { opacity: 0.6; }
    .step-active { opacity: 1; background: hsl(221 83% 53% / 0.05); }
    .step-header {
      font-weight: 700;
      font-size: 14px;
      margin-bottom: 8px;
      color: hsl(221 83% 53%);
    }
    .highlight-primary { color: hsl(221 83% 53%); font-weight: 600; }
    .highlight-accent { color: hsl(30 95% 50%); font-weight: 600; }
    .mark-equal { color: hsl(142 71% 45%); font-weight: 600; }
    .draw-path {
      stroke-dasharray: 1000;
      stroke-dashoffset: 1000;
      animation: draw 1.5s ease-in-out forwards;
    }
    @keyframes draw {
      to { stroke-dashoffset: 0; }
    }
    svg { max-width: 100%; height: auto; margin: 8px auto; display: block; }
    ${lesson.globalStyles}
  </style>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body>${stepHtml}</body>
</html>`
}
