'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/stores/i18n-store';
import { Button } from '@/components/ui/button';

export function LandingCta() {
  const { t } = useI18n();
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/70 p-10 text-center text-primary-foreground shadow-premium sm:p-16"
        >
          {/* Animated background elements */}
          <div className="absolute inset-0 bg-grid opacity-20" />
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-20 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-accent/30 blur-3xl"
          />
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -bottom-20 right-10 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl"
          />
          {/* RDC flag accent */}
          <div className="absolute top-0 left-0 h-1 w-full rdc-flag-stripe opacity-60" />

          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-xs font-medium text-primary-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Rejoignez le mouvement
            </span>
            <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-bold sm:text-4xl lg:text-5xl">
              Rejoignez la transformation numérique du Congo
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/80">
              Créez votre compte et accédez à l&rsquo;ensemble des services de la
              plateforme nationale intelligente de gestion urbaine.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary" className="w-full shadow-lg sm:w-auto">
                <Link href="/register">
                  {t('nav.register')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
              >
                <Link href="/contact">{t('nav.contact')}</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
