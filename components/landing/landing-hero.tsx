'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight, Play, Sparkles, Radio, Activity, Cpu, Brain,
  MapPin, Users, Layers, ShieldCheck, ChevronDown, Zap,
} from 'lucide-react';
import { useI18n } from '@/lib/stores/i18n-store';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useRef } from 'react';

const DRC_BG = 'https://images.pexels.com/photos/30219277/pexels-photo-30219277.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop';

const stats = [
  { key: 'stats.citizens', value: 95_400_000, suffix: '+', icon: Users, color: 'text-sky-500' },
  { key: 'stats.provinces', value: 26, suffix: '', icon: MapPin, color: 'text-primary' },
  { key: 'stats.services', value: 48, suffix: '', icon: Layers, color: 'text-accent' },
  { key: 'stats.reports', value: 1_240_000, suffix: '+', icon: Activity, color: 'text-success' },
] as const;

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 2000;
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{display.toLocaleString('fr-FR')}{suffix}</span>;
}

const badges = [
  { label: 'Plateforme Nationale', icon: ShieldCheck },
  { label: 'Temps Réel', icon: Radio },
  { label: 'IA', icon: Brain },
  { label: 'IoT', icon: Cpu },
];

const ctaButtons = [
  { label: 'Découvrir la Plateforme', href: '/vision', variant: 'default' as const, icon: ArrowRight, primary: true },
  { label: 'Voir la Démonstration', href: '/dashboard', variant: 'outline' as const, icon: Play },
  { label: 'Se Connecter', href: '/login', variant: 'ghost' as const, icon: null },
  { label: 'Créer un Compte', href: '/register', variant: 'secondary' as const, icon: Sparkles },
];

export function LandingHero() {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '25%']);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);

  return (
    <section ref={ref} className="relative min-h-screen overflow-hidden bg-background">
      {/* Background image with parallax */}
      <motion.div style={{ y, scale }} className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${DRC_BG}')` }}
        />
      </motion.div>

      {/* Dark gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/70 to-background/95" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/30 to-background/50" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid opacity-15" />

      {/* Animated aurora orbs */}
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/4 left-10 h-80 w-80 rounded-full bg-primary/20 blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -50, 0], y: [0, 40, 0], scale: [1, 1.3, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-1/4 right-10 h-96 w-96 rounded-full bg-accent/15 blur-3xl"
      />
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 h-64 w-64 rounded-full bg-chart-2/10 blur-3xl"
      />

      {/* DRC flag accent bar — top */}
      <div className="absolute top-0 left-0 h-1 w-full rdc-flag-stripe opacity-70" />

      {/* Floating grid lines animation */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ y: [0, 100] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
          style={{ top: '20%' }}
        />
        <motion.div
          animate={{ y: [0, 100] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent"
          style={{ top: '60%' }}
        />
      </div>

      <motion.div style={{ opacity }} className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 pt-20 sm:px-6 lg:px-8">
        {/* Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 flex flex-wrap gap-2"
        >
          {badges.map((b, i) => (
            <motion.span
              key={b.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.1 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium backdrop-blur"
            >
              <b.icon className="h-3.5 w-3.5 text-primary" />
              {b.label}
            </motion.span>
          ))}
        </motion.div>

        {/* Live status indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success backdrop-blur"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          {t('hero.badge')}
        </motion.div>

        {/* Main title with staggered animation */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl"
        >
          <span className="text-gradient-primary">{t('hero.title')}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-4 max-w-2xl text-lg font-medium text-foreground/90 sm:text-xl"
        >
          {t('hero.subtitle')}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-4 max-w-2xl text-base text-muted-foreground"
        >
          {t('hero.description')}
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-8 flex flex-wrap gap-3"
        >
          {ctaButtons.map((btn) => (
            <Button
              key={btn.label}
              asChild
              size="lg"
              variant={btn.variant}
              className={btn.primary ? 'shadow-lg shadow-primary/30' : ''}
            >
              <Link href={btn.href}>
                {btn.label}
                {btn.icon && <btn.icon className="ml-2 h-4 w-4" />}
              </Link>
            </Button>
          ))}
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8 }}
          className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4"
        >
          {stats.map((s, i) => (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 + i * 0.1 }}
              whileHover={{ y: -4 }}
              className="glass-card rounded-xl p-5 text-center transition-shadow hover:shadow-float"
            >
              <s.icon className={`mx-auto mb-3 h-6 w-6 ${s.color}`} />
              <div className="font-display text-2xl font-bold sm:text-3xl">
                <AnimatedCounter value={s.value} suffix={s.suffix} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {t(s.key as never)}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center gap-1 text-muted-foreground"
        >
          <span className="text-xs">Défiler</span>
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </motion.div>
    </section>
  );
}
