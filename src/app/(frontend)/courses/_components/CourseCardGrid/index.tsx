'use client'

import type { Course } from '@/payload-types'
import { StaggerGrid, StaggerItem } from '@/ui/web/components/motion'
import { CourseCard } from '../CourseCard'

interface CourseCardGridProps {
  courses: Course[]
}

export function CourseCardGrid({ courses }: CourseCardGridProps) {
  return (
    <StaggerGrid className="grid gap-content-gap-xl md:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <StaggerItem key={course.id}>
          <CourseCard course={course} />
        </StaggerItem>
      ))}
    </StaggerGrid>
  )
}
