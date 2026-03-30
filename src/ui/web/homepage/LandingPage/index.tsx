'use client'

import { cn } from '@/infra/utils/ui'
import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'
import { ThemeSelector } from '@/ui/web/providers/Theme/ThemeSelector'
import { LanguageSwitcher } from '@/ui/web/LanguageSwitcher'
import { motion } from 'framer-motion'
import { BookOpen, GraduationCap, MessageCircle, Target, Trophy } from 'lucide-react'

interface LandingPageProps {
  onGetStarted: () => void
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

const ease = [0.25, 0.46, 0.45, 0.94] as const

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease } },
}

const FEATURES = [
  {
    key: 'study',
    icon: BookOpen,
    color: 'hsl(217 91% 60%)',
    bgClass: 'from-blue-500/20 to-blue-600/5',
  },
  {
    key: 'practice',
    icon: Target,
    color: 'hsl(0 72% 51%)',
    bgClass: 'from-red-500/20 to-red-600/5',
  },
  {
    key: 'ask',
    icon: MessageCircle,
    color: 'hsl(142 71% 45%)',
    bgClass: 'from-green-500/20 to-green-600/5',
  },
  {
    key: 'test',
    icon: Trophy,
    color: 'hsl(330 81% 60%)',
    bgClass: 'from-pink-500/20 to-pink-600/5',
  },
] as const

const STEPS = [
  { key: 'choose', icon: GraduationCap },
  { key: 'learn', icon: BookOpen },
  { key: 'master', icon: Trophy },
] as const

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const t = useTranslations('landing')

  // Header/footer hiding is managed by HomePage parent component

  return (
    <div className="overflow-hidden">
      {/* ─── FLOATING CONTROLS ─── */}
      <div className="fixed top-4 end-4 z-50 flex items-center gap-2 bg-card/80 backdrop-blur-xl rounded-xl border border-border/50 shadow-elevation-2 px-2 py-1">
        <LanguageSwitcher />
        <div className="w-px h-6 bg-border/50" />
        <ThemeSelector />
      </div>

      {/* ─── HERO ─── */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Animated gradient mesh background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-background to-background" />
          <motion.div
            className="absolute top-[-20%] start-[-10%] w-[60vw] h-[60vw] rounded-full bg-primary/[0.07] blur-[120px]"
            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-[-10%] end-[-10%] w-[50vw] h-[50vw] rounded-full bg-accent/[0.06] blur-[100px]"
            animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-[30%] end-[20%] w-[30vw] h-[30vw] rounded-full bg-success/[0.04] blur-[80px]"
            animate={{ x: [0, -15, 0], y: [0, 15, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <motion.div
          className="container text-center max-w-4xl px-6"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div variants={fadeUp} className="mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-body-sm font-medium border border-primary/20">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              {t('hero.badge')}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="text-display-lg md:text-display-xl lg:text-display-2xl font-bold tracking-tight mb-6"
          >
            <span className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('hero.title')}
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            className="text-body-lg md:text-body-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            {t('hero.subtitle')}
          </motion.p>

          {/* CTA */}
          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row gap-content-gap justify-center"
          >
            <Button
              size="lg"
              onClick={onGetStarted}
              className="h-14 px-10 rounded-xl shadow-elevation-3 hover:shadow-elevation-4 text-primary-foreground text-[1.125rem]"
            >
              {t('hero.cta')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={onGetStarted}
              className="h-14 px-10 rounded-xl text-[1.125rem]"
            >
              {t('hero.secondaryCta')}
            </Button>
          </motion.div>

          {/* Floating preview cards (decorative) */}
          <motion.div variants={fadeUp} className="mt-16 relative">
            <div className="relative mx-auto max-w-3xl">
              <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 shadow-elevation-4 p-card-padding md:p-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-content-gap">
                  {FEATURES.map((f) => {
                    const Icon = f.icon
                    return (
                      <div
                        key={f.key}
                        className="flex flex-col items-center gap-2 p-card-padding-sm rounded-xl bg-muted/50"
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${f.color.replace(')', ' / 0.15)')}` }}
                        >
                          <Icon className="w-5 h-5" style={{ color: f.color }} />
                        </div>
                        <span className="text-body-sm font-medium">
                          {t(`features.${f.key}.title`)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="py-section-lg">
        <div className="container max-w-6xl px-6">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={container}
          >
            <motion.h2
              variants={fadeUp}
              className="text-display-sm md:text-display-md font-bold mb-4"
            >
              {t('features.heading')}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-body-lg text-muted-foreground max-w-xl mx-auto"
            >
              {t('features.subheading')}
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-content-gap-lg"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={container}
          >
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.key}
                  variants={scaleIn}
                  className={cn(
                    'group relative p-8 rounded-2xl border border-border/50',
                    'bg-gradient-to-br',
                    feature.bgClass,
                    'hover:shadow-card-hover transition-all duration-normal hover:-translate-y-1',
                  )}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                    style={{ backgroundColor: `${feature.color.replace(')', ' / 0.15)')}` }}
                  >
                    <Icon className="w-7 h-7" style={{ color: feature.color }} />
                  </div>
                  <h3 className="text-heading-lg font-bold mb-2">
                    {t(`features.${feature.key}.title`)}
                  </h3>
                  <p className="text-body-md text-muted-foreground leading-relaxed">
                    {t(`features.${feature.key}.description`)}
                  </p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-section-lg bg-muted/30">
        <div className="container max-w-4xl px-6">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={container}
          >
            <motion.h2
              variants={fadeUp}
              className="text-display-sm md:text-display-md font-bold mb-4"
            >
              {t('howItWorks.heading')}
            </motion.h2>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-content-gap-xl md:gap-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={container}
          >
            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.div key={step.key} variants={fadeUp} className="text-center relative">
                  {/* Connecting line (hidden on mobile) */}
                  {i < STEPS.length - 1 && (
                    <div className="hidden md:block absolute top-8 start-[60%] w-full h-px bg-border" />
                  )}

                  <div className="relative z-10 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-5">
                    <Icon className="w-7 h-7" />
                    <span className="absolute -top-2 -end-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-body-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="text-heading-md font-bold mb-2">
                    {t(`howItWorks.steps.${step.key}.title`)}
                  </h3>
                  <p className="text-body-sm text-muted-foreground">
                    {t(`howItWorks.steps.${step.key}.description`)}
                  </p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* ─── BOTTOM CTA ─── */}
      <section className="py-section-xl">
        <motion.div
          className="container max-w-3xl px-6 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={container}
        >
          <motion.div
            variants={scaleIn}
            className="relative p-10 md:p-16 rounded-3xl bg-gradient-to-br from-primary/10 via-card to-accent/10 border border-primary/20 overflow-hidden"
          >
            {/* Background glow */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-0 start-1/4 w-48 h-48 bg-primary/10 rounded-full blur-[80px]" />
              <div className="absolute bottom-0 end-1/4 w-48 h-48 bg-accent/10 rounded-full blur-[80px]" />
            </div>

            <h2 className="text-display-sm md:text-display-md font-bold mb-4">
              {t('cta.heading')}
            </h2>
            <p className="text-body-lg text-muted-foreground mb-8 max-w-lg mx-auto">
              {t('cta.subheading')}
            </p>
            <Button
              size="lg"
              onClick={onGetStarted}
              className="h-14 px-12 rounded-xl shadow-elevation-3 hover:shadow-elevation-4 text-primary-foreground text-[1.125rem]"
            >
              {t('cta.button')}
            </Button>
          </motion.div>
        </motion.div>
      </section>
    </div>
  )
}
