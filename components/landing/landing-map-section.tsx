'use client';

import { motion } from 'framer-motion';
import { useI18n } from '@/lib/stores/i18n-store';
import { DrcMap } from '@/components/landing/drc-map';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function LandingMapSection() {
  const { t } = useI18n();
  return (
    <section className="overflow-x-clip py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Couverture nationale
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
              Toutes les provinces, connectées
            </h2>
            <p className="mt-4 text-muted-foreground">
              De Kinshasa à Bunia, de Goma à Matadi, la plateforme SMART CITY RDC
              couvre l&rsquo;ensemble des 26 provinces du pays. Chaque commune, chaque
              service public et chaque citoyen est intégré au réseau national.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Supervision nationale en temps réel',
                'Coordination inter-provinces automatisée',
                'Données consolidées et sécurisées',
                'Tableaux de bord par niveau administratif',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success">
                    <ArrowRight className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-8">
              <Link href="/dashboard">
                Explorer la carte interactive
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass-card rounded-2xl p-8"
          >
            <DrcMap />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
