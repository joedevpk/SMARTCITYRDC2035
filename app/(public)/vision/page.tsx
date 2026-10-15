'use client';

import { motion } from 'framer-motion';
import { Eye, Target, Globe2, Users, TrendingUp, Leaf, Cpu, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/lib/stores/i18n-store';
import { PageHeader } from '@/components/shared/page-header';

const pillars = [
  { icon: Cpu, title: 'Transformation numérique', desc: "Numériser l'ensemble des services publics et des processus administratifs d'ici 2035." },
  { icon: Globe2, title: 'Connectivité nationale', desc: 'Connecter les 26 provinces et 145 territoires à un réseau numérique souverain.' },
  { icon: Users, title: 'Inclusion citoyenne', desc: 'Donner à chaque Congolais accès aux services publics en ligne, en français, swahili et lingala.' },
  { icon: TrendingUp, title: 'Croissance économique', desc: "Stimuler l'économie numérique et créer plus de 500 000 emplois dans le secteur technologique." },
  { icon: Leaf, title: 'Durabilité environnementale', desc: 'Utiliser la technologie pour gérer les ressources naturelles et réduire les déchets urbains.' },
  { icon: ShieldCheck, title: 'Souveraineté des données', desc: 'Garantir que les données nationales restent sous contrôle congolais et sécurisées.' },
];

export default function VisionPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        badge="2035"
        title={t('vision.title')}
        subtitle={t('vision.subtitle')}
      />
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Eye className="mx-auto mb-6 h-12 w-12 text-primary" />
            <p className="text-lg leading-relaxed text-muted-foreground">
              "Faire de la République Démocratique du Congo une nation
              numérique de référence en Afrique, où chaque citoyen, chaque
              commune et chaque institution est connecté à un écosystème
              intelligent, transparent et au service du développement
              durable."
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-16 rounded-2xl border border-border bg-card p-8 text-center">
            <Target className="mx-auto mb-4 h-10 w-10 text-accent" />
            <h3 className="font-display text-2xl font-bold">Objectif 2035</h3>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Atteindre un indice de développement numérique de 80% et
              connecter 100 millions de Congolais aux services publics
              intelligents.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
