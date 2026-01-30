import type { TaskConfig } from 'payload'

interface RegisteredTask {
  slug: string
  handler: TaskConfig['handler']
  description?: string
}

class TaskRegistry {
  private tasks = new Map<string, RegisteredTask>()

  register(task: RegisteredTask): void {
    this.tasks.set(task.slug, task)
  }

  get(slug: string): RegisteredTask | undefined {
    return this.tasks.get(slug)
  }

  has(slug: string): boolean {
    return this.tasks.has(slug)
  }

  list(): string[] {
    return Array.from(this.tasks.keys())
  }

  describe(slug: string): { description?: string; exists: boolean } {
    const task = this.tasks.get(slug)
    return { description: task?.description, exists: !!task }
  }
}

export const taskRegistry = new TaskRegistry()

/**
 * Auto-register a task for dynamic lookup (used by admin/debug endpoints)
 */
export function registerTask(slug: string, handler: TaskConfig['handler'], description?: string) {
  taskRegistry.register({ slug, handler, description })
}
