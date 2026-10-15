'use client';

import { motion } from 'framer-motion';
import {
  TrafficCone, Trash2, Lightbulb, Camera, HeartPulse, Shield, Droplets, Zap, AlertTriangle,
} from 'lucide-react';
import { useI18n } from '@/lib/stores/i18n-store';
import { PageHeader } from '@/components/shared/page-header';

const services = [
  { icon: TrafficCone, title: 'Gestion du trafic', desc: 'Supervision en temps réel du réseau routier et optimisation de la mobilité urbaine.', color: 'text-blue-500' },
  { icon: Trash2, title: 'Gestion des déchets', desc: 'Collecte, tri et traitement des déchets avec suivi GPS des camions.', color: 'text-green-500' },
  { icon: Lightbulb, title: 'Éclairage public', desc: 'Contrôle intelligent des lampadaires et détection automatique des pannes.', color: 'text-yellow-500' },
  { icon: Camera, title: 'Vidéoprotection', desc: 'Réseau de caméras urbaines pour la sécurité publique et la régulation.', color: 'text-purple-500' },
  { icon: HeartPulse, title: 'Services de santé', desc: 'Cartographie des hôpitaux, cliniques et centres de santé connectés.', color: 'text-red-500' },
  { icon: Shield, title: 'Sécurité publique', desc: 'Coordination des forces de l\'ordre et gestion des interventions.', color: 'text-indigo-500' },
  { icon: Droplets, title: 'Distribution d\'eau', desc: 'Suivi du réseau d\'eau potable et signalement des fuites.', color: 'text-cyan-500' },
  { icon: Zap, title: 'Réseau électrique', desc: 'Supervision du réseau électrique et gestion des coupures.', color: 'text-amber-500' },
  { icon: AlertTriangle, title: 'Gestion des incidents', desc: 'Centralisation et traitement des signalements citoyens en temps réel.', color: 'text-orange-500' },
];

export default function ServicesPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        badge="9 services publics"
        title={t('services.title')}
        subtitle={t('services.subtitle')}
      />
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <s.icon className={`h-6 w-6 ${s.color}`} />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
