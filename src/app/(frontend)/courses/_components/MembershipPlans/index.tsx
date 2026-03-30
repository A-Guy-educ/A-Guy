'use client'

import { PlanCard } from '../PlanCard'
import { useTranslations } from '@/ui/web/providers/I18n'

export function MembershipPlans() {
  const t = useTranslations('shop')

  const membershipPlans = [
    {
      title: t('plans.free.title'),
      subtitle: t('plans.free.subtitle'),
      price: 0,
      period: t('perMonth'),
      features: [
        { icon: 'x' as const, text: t('features.learningSystemNo'), style: 'disabled' as const },
        {
          icon: 'check' as const,
          text: t('features.practiceSystemFull'),
          style: 'enabled' as const,
        },
        { icon: 'help' as const, text: t('features.questionsLimited'), style: 'limited' as const },
        { icon: 'x' as const, text: t('features.examsNo'), style: 'disabled' as const },
      ],
      courseCount: {
        number: 1,
        text: t('plans.free.courseCount'),
        color: 'font-bold text-primary',
        icon: 'book' as const,
      },
      buttonText: t('plans.free.currentPlan'),
      buttonStyle: 'current' as const,
    },
    {
      title: t('plans.standard.title'),
      subtitle: t('plans.standard.subtitle'),
      price: 100,
      period: t('perMonth'),
      features: [
        { icon: 'x' as const, text: t('features.learningSystemNo'), style: 'disabled' as const },
        {
          icon: 'check' as const,
          text: t('features.practiceSystemFull'),
          style: 'enabled' as const,
        },
        { icon: 'help' as const, text: t('features.questionsLimited'), style: 'limited' as const },
        { icon: 'x' as const, text: t('features.examsNo'), style: 'disabled' as const },
      ],
      courseCount: {
        number: 1,
        text: t('plans.standard.courseCount'),
        color: 'font-bold text-primary',
        icon: 'book' as const,
      },
      buttonText: t('plans.standard.selectPlan'),
      buttonStyle: 'standard' as const,
      isBordered: true,
    },
    {
      title: t('plans.premium.title'),
      subtitle: t('plans.premium.subtitle'),
      price: 179,
      period: t('perMonth'),
      badge: t('plans.premium.badge'),
      badgeColor: 'bg-primary font-black',
      features: [
        {
          icon: 'check' as const,
          text: t('features.learningSystemFull'),
          style: 'enabled' as const,
        },
        {
          icon: 'check' as const,
          text: t('features.practiceSystemFull'),
          style: 'enabled' as const,
        },
        { icon: 'help' as const, text: t('features.questionsLimited'), style: 'limited' as const },
        { icon: 'help' as const, text: t('features.examsLimited'), style: 'limited' as const },
      ],
      courseCount: {
        number: 3,
        text: t('plans.premium.courseCount'),
        color: 'font-bold text-primary',
        icon: 'layers' as const,
      },
      buttonText: t('plans.premium.joinNow'),
      buttonStyle: 'premium' as const,
      isPremium: true,
    },
  ]

  return (
    <section className="mb-24">
      <div className="text-center mb-12">
        <h2 className="text-heading-xl font-black text-card-foreground uppercase tracking-widest">
          {t('membershipPlans')}
        </h2>
      </div>

      <div className="grid gap-content-gap-xl md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
        {membershipPlans.map((plan, index) => (
          <PlanCard key={index} {...plan} />
        ))}
      </div>
    </section>
  )
}
