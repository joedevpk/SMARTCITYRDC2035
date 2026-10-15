'use client';

import { motion } from 'framer-motion';
import { Rocket, Network, BarChart3, Bell, Map, FileCheck, Smartphone, Cloud, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/lib/stores/i18n-store';
import { PageHeader } from '@/components/shared/page-header';

const missions = [
  { icon: Network, title: 'Connecter', desc: "Relier le Gouvernement, les Ministères, les Provinces, les Communes et les Citoyens dans un réseau numérique unifié." },
  { icon: BarChart3, title: 'Informer', desc: 'Fournir des données en temps réel pour une prise de décision publique transparente et éclairée.' },
  { icon: Bell, title: 'Coordonner', desc: "Synchroniser les interventions des services publics sur tout le territoire national." },
  { icon: Map, title: 'Cartographier', desc: "Numériser et visualiser les infrastructures, services et incidents à l'échelle nationale." },
  { icon: FileCheck, title: 'Administrer', desc: 'Simplifier et numériser les démarches administratives pour les citoyens et les agents.' },
  { icon: Smartphone, title: 'Inclure', desc: "Garantir l'accès de tous aux services publics, en français, swahili et lingala." },
];

export default function MissionPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        badge="Notre engagement"
        title={t('mission.title')}
        subtitle={t('mission.subtitle')}
      />
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Rocket className="mx-auto mb-6 h-12 w-12 text-primary" />
            <p className="text-lg leading-relaxed text-muted-foreground">
              "Transformer la gestion urbaine de la République Démocratique du
              Congo par la technologie, en plaçant le citoyen au cœur de
              l'administration publique et en dotant chaque niveau de
              gouvernance d'outils intelligents, fiables et accessibles."
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {missions.map((m, i) => (
              <motion.div
                key={m.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <m.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold">{m.title}</h3>
                <p className="text-sm text-muted-foreground">{m.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              { icon: Cloud, title: 'Infrastructure souveraine', desc: 'Hébergement national des données critiques' },
              { icon: ShieldCheck, title: 'Sécurité by design', desc: 'Chiffrement de bout en bout et conformité RGPD' },
              { icon: Smartphone, title: 'Accessibilité universelle', desc: 'Compatible mobile, web et faible débit' },
            ].map((item) => (
              <div key={item.title} className="glass-card rounded-xl p-6">
                <item.icon className="mb-3 h-8 w-8 text-primary" />
                <h4 className="font-display font-semibold">{item.title}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
