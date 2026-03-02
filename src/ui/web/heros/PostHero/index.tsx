'use client'
import type { Post } from '@/payload-types'
import { useHeaderTheme } from '@/ui/web/providers/HeaderTheme'
import { Media } from '@/ui/web/media'
import React, { useEffect } from 'react'

export const PostHero: React.FC<{ post: Post }> = ({ post }) => {
  const { setHeaderTheme } = useHeaderTheme()

  useEffect(() => {
    setHeaderTheme('dark')
  }, [setHeaderTheme])

  return (
    <div className="relative -mt-[10.4rem]" data-theme="dark">
      {post.heroImage && typeof post.heroImage === 'object' && (
        <div className="relative w-full h-[34rem] overflow-hidden">
          <Media
            fill
            className="absolute inset-0"
            imgClassName="object-cover w-full h-full"
            priority
            resource={post.heroImage}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}
      <div className="container relative z-10 pb-8">
        <div className="max-w-[48rem] mx-auto">
          {post.title && (
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 pt-8">{post.title}</h1>
          )}
        </div>
      </div>
    </div>
  )
}
