import React from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { notFound } from 'next/navigation'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer/ExerciseRenderer'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { Badge } from '@/ui/web/components/badge'

type Args = {
  params: Promise<{
    id?: string
  }>
}

export default async function ExercisePage({ params: paramsPromise }: Args) {
  const { id } = await paramsPromise

  if (!id) {
    return notFound()
  }

  const payload = await getPayload({ config: configPromise })

  try {
    const exercise = await payload.findByID({
      collection: 'exercises',
      id,
      depth: 1,
      overrideAccess: false,
    })

    if (!exercise) {
      return notFound()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = (exercise as any).content as ExerciseContentData

    return (
      <div className="container py-10 max-w-4xl mx-auto">
        <Card className="mb-8 border-none shadow-none bg-transparent">
          <CardHeader className="px-0">
            <CardTitle className="text-display-sm font-bold text-slate-900">
              {exercise.title}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="shadow-elevation-1 border-slate-200">
          <CardContent className="p-card-padding-lg">
            <ExerciseRenderer
              content={content}
              mode="student"
              showCheckAnswer
              showExerciseNumber={exercise.showQuestionNumbering ?? false}
            />
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center gap-content-gap-xs">
          <span className="text-body-xs text-slate-400 font-medium uppercase tracking-wider">
            Exercise ID:
          </span>
          <Badge variant="outline" className="font-mono text-[10px] text-slate-500">
            {exercise.id}
          </Badge>
        </div>
      </div>
    )
  } catch (error) {
    console.error(`Error fetching exercise ${id}:`, error)
    return notFound()
  }
}
