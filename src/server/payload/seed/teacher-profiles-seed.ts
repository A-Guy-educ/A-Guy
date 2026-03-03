/**
 * Teacher Profiles Seed
 *
 * Seeds 5 Prompt entries and 5 TeacherProfile entries for teacher profile functionality.
 * Idempotent - checks by key/slug before creating.
 *
 * @fileType seed
 * @domain ai
 */

import type { Payload } from 'payload'

/**
 * Teacher profile configurations to seed
 */
const TEACHER_PROFILES = [
  {
    slug: 'teacher_strict',
    label: 'Strict Teacher',
    description: 'Maintains high standards and expects precise, accurate responses.',
    promptKey: 'teacher-strict-v1',
    promptTitle: 'Strict Teacher v1',
    promptTemplate: `You are a strict but fair teacher who maintains high academic standards.
- Require precise, accurate answers from students
- Point out errors and misconceptions clearly
- Encourage rigorous thinking and attention to detail
- Celebrate correct answers but remain professional
- Do not accept incomplete or sloppy work`,
  },
  {
    slug: 'teacher_thorough',
    label: 'Thorough Teacher',
    description: 'Provides comprehensive explanations with extensive detail.',
    promptKey: 'teacher-thorough-v1',
    promptTitle: 'Thorough Teacher v1',
    promptTemplate: `You are a thorough teacher who provides comprehensive, detailed explanations.
- Break down concepts into small, digestible parts
- Provide multiple examples and analogies
- Connect new information to previously learned concepts
- Anticipate follow-up questions and address them proactively
- Ensure complete understanding before moving on`,
  },
  {
    slug: 'teacher_patient',
    label: 'Patient Teacher',
    description: 'Approaches learning with patience and encouragement.',
    promptKey: 'teacher-patient-v1',
    promptTitle: 'Patient Teacher v1',
    promptTemplate: `You are a patient, supportive teacher who prioritizes student confidence.
- Allow students time to think and process information
- Offer gentle hints and guidance rather than direct answers
- Celebrate small victories and progress
- Never make students feel rushed or inadequate
- Reassure students that making mistakes is part of learning`,
  },
  {
    slug: 'teacher_focused',
    label: 'Focused Teacher',
    description: 'Keeps lessons on track with clear objectives and efficient delivery.',
    promptKey: 'teacher-focused-v1',
    promptTitle: 'Focused Teacher v1',
    promptTemplate: `You are a focused teacher who keeps lessons efficient and goal-oriented.
- Start each interaction by clarifying the learning objective
- Stay on topic and minimize tangents
- Provide concise, relevant information
- Redirect off-topic discussions politely
- Summarize key points at the end of each interaction`,
  },
  {
    slug: 'teacher_challenging',
    label: 'Challenging Teacher',
    description: 'Pushes students with thought-provoking questions and advanced material.',
    promptKey: 'teacher-challenging-v1',
    promptTitle: 'Challenging Teacher v1',
    promptTemplate: `You are a challenging teacher who pushes students to reach their full potential.
- Ask probing questions that require deep thinking
- Introduce advanced concepts and extensions
- Encourage students to explain their reasoning
- Challenge assumptions and invite debate
- Set high expectations and help students meet them`,
  },
]

/**
 * Seed teacher profiles and their associated prompts
 * Idempotent - safe to re-run
 */
export async function seedTeacherProfiles(payload: Payload): Promise<void> {
  payload.logger.info('[TeacherProfilesSeed] Starting teacher profiles seed...')

  // Get default tenant (required for Prompts collection which has tenantField)
  const tenantSlug = process.env.DEFAULT_TENANT_SLUG || 'default'
  const tenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: tenantSlug } },
    limit: 1,
    overrideAccess: true,
  })

  if (tenants.docs.length === 0) {
    payload.logger.error(
      `[TeacherProfilesSeed] Default tenant "${tenantSlug}" not found. ` +
        'Prompts cannot be created without a tenant, so TeacherProfiles will have no linked prompts. ' +
        'The resolver will fall back to the failsafe prompt for all users.',
    )
    return
  }

  const tenantId = tenants.docs[0].id as string

  for (const profile of TEACHER_PROFILES) {
    // Check if prompt already exists
    const existingPrompt = await payload.find({
      collection: 'prompts',
      where: { promptKey: { equals: profile.promptKey } },
      limit: 1,
      overrideAccess: true,
    })

    let promptId: string

    if (existingPrompt.docs.length > 0) {
      promptId = existingPrompt.docs[0].id as string
      payload.logger.info(
        `[TeacherProfilesSeed] Prompt ${profile.promptKey} already exists, skipping`,
      )
    } else {
      // Create prompt
      const createdPrompt = await payload.create({
        collection: 'prompts',
        data: {
          title: profile.promptTitle,
          promptKey: profile.promptKey,
          locale: 'he',
          type: 'context',
          template: profile.promptTemplate,
          status: 'published',
          usage: 'chat',
          isDefaultForAgentChat: false,
          tenant: tenantId,
        },
        draft: false,
        overrideAccess: true,
      })
      promptId = createdPrompt.id as string
      payload.logger.info(`[TeacherProfilesSeed] Created prompt ${profile.promptKey}`)
    }

    // Check if teacher profile already exists
    const existingProfile = await payload.find({
      collection: 'teacher_profiles',
      where: { slug: { equals: profile.slug } },
      limit: 1,
      overrideAccess: true,
    })

    if (existingProfile.docs.length > 0) {
      payload.logger.info(
        `[TeacherProfilesSeed] Teacher profile ${profile.slug} already exists, skipping`,
      )
    } else {
      // Create teacher profile
      await payload.create({
        collection: 'teacher_profiles',
        data: {
          slug: profile.slug,
          label: profile.label,
          description: profile.description,
          systemPrompt: promptId,
          isEnabled: true,
        },
        overrideAccess: true,
      })
      payload.logger.info(`[TeacherProfilesSeed] Created teacher profile ${profile.slug}`)
    }
  }

  payload.logger.info('[TeacherProfilesSeed] Teacher profiles seed completed')
}
