import React from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { notFound } from 'next/navigation'
import { ExerciseRenderer } from '@/components/ExerciseRenderer/ExerciseRenderer'
import type { ExerciseContent, ExerciseBlock, FigureBlock, SectionBlock } from '@/contracts'

// Recursive function to extract asset IDs from blocks
const extractAssetIds = (blocks: any[]): string[] => {
  let ids: string[] = []

  for (const block of blocks) {
    if (block.type === 'figure' && block.assetId) {
      ids.push(block.assetId)
    } else if (block.type === 'section' && block.blocks) {
      ids = [...ids, ...extractAssetIds(block.blocks)]
    }
  }

  return ids
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function ExercisePage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise

  if (!slug) {
    return notFound()
  }

  const payload = await getPayload({ config: configPromise })

  const exercises = await payload.find({
    collection: 'exercises',
    where: {
      slug: {
        equals: slug,
      },
    },
    depth: 1,
    limit: 1,
  })

  if (!exercises.docs || exercises.docs.length === 0) {
    return notFound()
  }

  const exercise = exercises.docs[0]
  const content = exercise.contentJson as ExerciseContent
  const answerSpec = exercise.answerSpecJson as any
  const questionType = exercise.questionType as any

  // Prefetch assets
  const assetIds = extractAssetIds(content.stem)
  const assetMap: Record<string, string> = {}

  if (assetIds.length > 0) {
    const assetsBlob = await payload.find({
      collection: 'exercise-assets' as any,
      where: {
        id: {
          in: assetIds,
        },
      },
      limit: 100, // Reasonable limit
    })

    assetsBlob.docs.forEach((asset: any) => {
      if (asset.url) {
        assetMap[asset.id] = asset.url
      }
    })
  }

  return (
    <div className="container py-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">{exercise.title}</h1>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <ExerciseRenderer
          content={content}
          answerSpec={answerSpec}
          questionType={questionType}
          availableAssets={assetMap}
          mode="student"
        />
      </div>

      <div className="mt-8 text-sm text-gray-400">
        Exercise ID: {exercise.id} | Slug: {slug}
      </div>
    </div>
  )
}
