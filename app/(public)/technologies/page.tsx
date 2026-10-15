'use client';

import { motion } from 'framer-motion';
import { Cloud, Database, Lock, Cpu, Globe, Layers, GitBranch, Activity } from 'lucide-react';
import { useI18n } from '@/lib/stores/i18n-store';
import { PageHeader } from '@/components/shared/page-header';

const techs = [
  { icon: Cloud, name: 'Cloud souverain', desc: 'Infrastructure cloud nationale hébergée en RDC' },
  { icon: Database, name: 'PostgreSQL / Supabase', desc: 'Base de données relationnelle managée et temps réel' },
  { icon: Lock, name: 'Sécurité zero-trust', desc: 'Chiffrement, RLS, 2FA et audit complet' },
  { icon: Cpu, name: 'IA & Machine Learning', desc: 'Prédictions, analyse de données et automatisation' },
  { icon: Globe, name: 'API REST & Edge', desc: 'APIs performantes déployées en bordure' },
  { icon: Layers, name: 'Cartographie temps réel', desc: 'Leaflet, MapLibre et tuiles vectorielles' },
  { icon: GitBranch, name: 'CI/CD automatisé', desc: 'Déploiement continu et tests automatisés' },
  { icon: Activity, name: 'Observabilité', desc: 'Monitoring, logs et métriques en temps réel' },
];

export default function TechnologiesPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        badge="Architecture"
        title={t('tech.title')}
        subtitle={t('tech.subtitle')}
      />
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {techs.map((tech, i) => (
              <motion.div
                key={tech.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-6 text-center"
              >
                <tech.icon className="mx-auto mb-4 h-10 w-10 text-primary" />
                <h3 className="mb-2 font-display text-base font-semibold">{tech.name}</h3>
                <p className="text-xs text-muted-foreground">{tech.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-16 rounded-2xl border border-border bg-card p-8">
            <h3 className="mb-6 font-display text-xl font-bold">Stack technique</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {['Next.js 16', 'TypeScript', 'Tailwind CSS', 'Shadcn UI', 'Framer Motion', 'React Query', 'Zustand', 'React Hook Form', 'Zod', 'Leaflet / MapLibre', 'Recharts', 'Supabase'].map((s) => (
                <div key={s} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
