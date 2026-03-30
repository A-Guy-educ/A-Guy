/**
 * Teacher Profiles Seed
 *
 * Seeds 5 Prompt entries and 5 TeacherProfile entries (×2 locales = 10 docs)
 * for teacher profile functionality. Uses the per-locale document pattern
 * consistent with Courses, Chapters, and Lessons.
 *
 * Idempotent - checks by slug + locale before creating.
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
    label_he: 'מורה קפדן',
    label_en: 'Strict Teacher',
    description_he: 'שומר על סטנדרטים גבוהים ומצפה לתשובות מדויקות.',
    description_en: 'Maintains high standards and expects precise, accurate responses.',
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
    label_he: 'מורה יסודי',
    label_en: 'Thorough Teacher',
    description_he: 'מספק הסברים מקיפים עם פרוט נרחב.',
    description_en: 'Provides comprehensive explanations with extensive detail.',
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
    label_he: 'מורה סבלני',
    label_en: 'Patient Teacher',
    description_he: 'ניגש ללמידה עם סבלנות ועידוד.',
    description_en: 'Approaches learning with patience and encouragement.',
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
    label_he: 'מורה ממוקד',
    label_en: 'Focused Teacher',
    description_he: 'שומר על השיעורים ממוקדים עם יעדים ברורים.',
    description_en: 'Keeps lessons on track with clear objectives and efficient delivery.',
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
    label_he: 'מורה מאתגר',
    label_en: 'Challenging Teacher',
    description_he: 'מאתגר תלמידים עם שאלות מעוררות מחשבה וחומר מתקדם.',
    description_en: 'Pushes students with thought-provoking questions and advanced material.',
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
 * Seed teacher profiles and their associated prompts.
 * Creates per-locale documents (Hebrew as source, English as translation).
 * Idempotent - safe to re-run.
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
    // --- Ensure prompt exists ---
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

    // --- Ensure Hebrew (source) document exists ---
    const existingHe = await payload.find({
      collection: 'teacher_profiles',
      where: {
        and: [{ slug: { equals: profile.slug } }, { locale: { equals: 'he' } }],
      },
      limit: 1,
      overrideAccess: true,
    })

    let heDocId: string

    if (existingHe.docs.length > 0) {
      heDocId = existingHe.docs[0].id as string
      // Update in case labels/descriptions changed
      await payload.update({
        collection: 'teacher_profiles',
        id: heDocId,
        data: {
          label: profile.label_he,
          description: profile.description_he,
          systemPrompt: promptId,
        },
        overrideAccess: true,
      })
      payload.logger.info(`[TeacherProfilesSeed] Updated teacher profile ${profile.slug} (he)`)
    } else {
      const created = await payload.create({
        collection: 'teacher_profiles',
        data: {
          slug: profile.slug,
          locale: 'he',
          label: profile.label_he,
          description: profile.description_he,
          systemPrompt: promptId,
          isEnabled: true,
        },
        overrideAccess: true,
      })
      heDocId = created.id as string
      payload.logger.info(`[TeacherProfilesSeed] Created teacher profile ${profile.slug} (he)`)
    }

    // --- Ensure English (translation) document exists ---
    const existingEn = await payload.find({
      collection: 'teacher_profiles',
      where: {
        and: [{ slug: { equals: profile.slug } }, { locale: { equals: 'en' } }],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (existingEn.docs.length > 0) {
      await payload.update({
        collection: 'teacher_profiles',
        id: existingEn.docs[0].id,
        data: {
          label: profile.label_en,
          description: profile.description_en,
          translatedFrom: heDocId,
          systemPrompt: promptId,
        },
        overrideAccess: true,
      })
      payload.logger.info(`[TeacherProfilesSeed] Updated teacher profile ${profile.slug} (en)`)
    } else {
      await payload.create({
        collection: 'teacher_profiles',
        data: {
          slug: profile.slug,
          locale: 'en',
          translatedFrom: heDocId,
          label: profile.label_en,
          description: profile.description_en,
          systemPrompt: promptId,
          isEnabled: true,
        },
        overrideAccess: true,
      })
      payload.logger.info(`[TeacherProfilesSeed] Created teacher profile ${profile.slug} (en)`)
    }
  }

  payload.logger.info('[TeacherProfilesSeed] Teacher profiles seed completed')
}
