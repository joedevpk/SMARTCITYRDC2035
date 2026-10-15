'use client';

import { motion } from 'framer-motion';
import {
  Map, Cpu, Brain, ShieldCheck, FileText, Bell,
  Building2, Users, Landmark, Zap, Activity, Globe,
} from 'lucide-react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: Map,
    title: 'Cartographie Intelligente',
    desc: 'Visualisation GIS temps réel avec PostGIS — routes, services, incidents et capteurs sur une carte interactive nationale.',
    href: '/dashboard/map',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Cpu,
    title: 'IoT & Objets Connectés',
    desc: 'Surveillance temps réel de 8,500+ capteurs — lampadaires, bacs à déchets, compteurs d\'eau et d\'énergie, feux de circulation.',
    href: '/dashboard/iot',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
  },
  {
    icon: Brain,
    title: 'Intelligence Artificielle',
    desc: 'Prédictions de trafic, prévisions énergétiques, optimisation des collectes de déchets et détection d\'anomalies automatique.',
    href: '/dashboard/ai',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  {
    icon: ShieldCheck,
    title: 'Sécurité & Audit',
    desc: 'Cybersécurité de niveau gouvernemental — journal d\'audit, détection d\'intrusion, rate limiting et protection contre le brute-force.',
    href: '/dashboard/security',
    color: 'text-red-500',
    bg: 'bg-red-500/10',
  },
  {
    icon: FileText,
    title: 'Signalements Citoyens',
    desc: 'Workflow complet de gestion des signalements — création, validation, assignation, suivi et résolution avec notifications.',
    href: '/dashboard/reports',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Bell,
    title: 'Notifications Temps Réel',
    desc: 'Alertes instantanées via Supabase Realtime — restez informé de chaque événement sur le territoire national.',
    href: '/dashboard/notifications',
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
  },
];

const levels = [
  { icon: Landmark, label: 'Présidentiel', desc: 'Vue stratégique nationale' },
  { icon: Building2, label: 'Gouvernement', desc: 'Coordination ministérielle' },
  { icon: Globe, label: 'National', desc: 'Pilotage des 26 provinces' },
  { icon: Users, label: 'Province', desc: 'Supervision régionale' },
  { icon: Building2, label: 'Commune', desc: 'Gestion locale' },
  { icon: Users, label: 'Citoyen', desc: 'Participation active' },
];

export function LandingFeatures() {
  return (
    <>
      {/* Features Grid */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-2xl text-center"
          >
            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Modules de la plateforme
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Une plateforme, six modules intelligents
            </h2>
            <p className="mt-4 text-muted-foreground">
              Chaque module est conçu pour répondre aux besoins spécifiques de la gestion urbaine moderne,
              de la supervision nationale à la participation citoyenne.
            </p>
          </motion.div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -6 }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-xl"
              >
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.bg} ${f.color}`}>
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                <Link
                  href={f.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100"
                >
                  Explorer
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                {/* Hover gradient */}
                <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-0" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Administrative Levels */}
      <section className="py-24 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-2xl text-center"
          >
            <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent-foreground">
              Architecture administrative
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Du Président au Citoyen
            </h2>
            <p className="mt-4 text-muted-foreground">
              Six niveaux administratifs interconnectés, chacun avec son tableau de bord dédié,
              ses permissions et ses outils de pilotage.
            </p>
          </motion.div>

          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {levels.map((l, i) => (
              <motion.div
                key={l.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -4 }}
                className="flex flex-col items-center rounded-xl border border-border bg-card p-5 text-center"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <l.icon className="h-6 w-6" />
                </div>
                <p className="font-display text-sm font-semibold">{l.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{l.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Accéder aux tableaux de bord
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Tech showcase */}
      <section className="overflow-x-clip py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Technologies de pointe
              </span>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Une architecture moderne et sécurisée
              </h2>
              <p className="mt-4 text-muted-foreground">
                Construite sur les meilleures technologies du marché, la plateforme SMART CITY RDC 2035
                offre des performances exceptionnelles, une sécurité de niveau gouvernemental et
                une scalabilité nationale.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  { icon: Zap, label: 'Next.js 13 + React 18', desc: 'Performance et SEO optimal' },
                  { icon: Activity, label: 'Supabase + PostgreSQL + PostGIS', desc: 'Base de données temps réel avec géospatial' },
                  { icon: ShieldCheck, label: 'Row Level Security + Audit', desc: 'Sécurité au niveau base de données' },
                  { icon: Brain, label: 'Edge Functions IA + IoT', desc: 'Intelligence déployée à la périphérie' },
                ].map((tech) => (
                  <div key={tech.label} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <tech.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{tech.label}</p>
                      <p className="text-xs text-muted-foreground">{tech.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="glass-card rounded-2xl p-8">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Disponibilité', value: '99.9%', icon: Activity, color: 'text-success' },
                    { label: 'Latence API', value: '< 50ms', icon: Zap, color: 'text-primary' },
                    { label: 'Capteurs IoT', value: '8,500+', icon: Cpu, color: 'text-chart-2' },
                    { label: 'Prédictions IA/jour', value: '10,000+', icon: Brain, color: 'text-chart-5' },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="rounded-xl border border-border bg-card p-5 text-center"
                    >
                      <stat.icon className={`mx-auto mb-2 h-6 w-6 ${stat.color}`} />
                      <p className="font-display text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-center text-xs text-muted-foreground">
                    Surveillance continue · 24/7 · Temps réel
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}
