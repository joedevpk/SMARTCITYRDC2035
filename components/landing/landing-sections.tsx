'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Target, Eye, Sparkles, Zap, ShieldCheck, Users, Building2,
  Globe, Cpu, Brain, Map, Activity, ArrowRight, CheckCircle2,
  TrendingUp, Lock, Radio, Database, Server, Cloud, Code2,
} from 'lucide-react';
import { useI18n } from '@/lib/stores/i18n-store';
import { Button } from '@/components/ui/button';

const visionPillars = [
  { icon: Globe, title: 'Couverture Nationale', desc: '26 provinces, 145+ territoires et toutes les communes interconnectés en un seul réseau.' },
  { icon: Cpu, title: 'Intelligence Artificielle', desc: 'Prédictions temps réel, détection d\'anomalies et optimisation automatique des ressources.' },
  { icon: Users, title: 'Gouvernance Participative', desc: 'Chaque citoyen peut signaler, suivre et contribuer à l\'amélioration de sa communauté.' },
  { icon: ShieldCheck, title: 'Sécurité Souveraine', desc: 'Données protégées au niveau gouvernemental, hébergées et gérées par et pour la RDC.' },
];

const services = [
  { icon: Map, title: 'Cartographie Intelligente', desc: 'Visualisation GIS temps réel — routes, services, incidents et capteurs sur carte interactive.', href: '/dashboard/map', color: 'text-sky-500', bg: 'bg-sky-500/10' },
  { icon: Cpu, title: 'IoT & Objets Connectés', desc: 'Surveillance de 8,500+ capteurs — lampadaires, bacs, compteurs d\'eau et d\'énergie, feux.', href: '/dashboard/iot', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { icon: Brain, title: 'Intelligence Artificielle', desc: 'Prédictions de trafic, prévisions énergétiques, optimisation des collectes, détection d\'anomalies.', href: '/dashboard/ai', color: 'text-violet-500', bg: 'bg-violet-500/10' },
  { icon: ShieldCheck, title: 'Sécurité & Audit', desc: 'Cybersécurité de niveau gouvernemental — audit, intrusion, rate limiting, anti brute-force.', href: '/dashboard/security', color: 'text-red-500', bg: 'bg-red-500/10' },
  { icon: Activity, title: 'Signalements Citoyens', desc: 'Workflow complet — création, validation, assignation, suivi et résolution avec notifications.', href: '/dashboard/reports', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { icon: Radio, title: 'Notifications Temps Réel', desc: 'Alertes instantanées via Supabase Realtime — informé de chaque événement national.', href: '/dashboard/notifications', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
];

const citizenBenefits = [
  'Signaler un problème en moins de 2 minutes',
  'Suivre le traitement en temps réel',
  'Recevoir des notifications personnalisées',
  'Accéder aux services publics en ligne',
  'Participer à la vie de sa commune',
  'Consulter les statistiques de sa région',
];

const govBenefits = [
  'Vue d\'ensemble du territoire en temps réel',
  'Pilotage multi-niveaux (Président → Commune)',
  'Indicateurs de performance automatisés',
  'Audit complet et traçabilité des actions',
  'Prise de décision basée sur les données',
  'Coordination inter-ministérielle fluide',
];

const steps = [
  { num: '01', icon: Users, title: 'Inscription & Connexion', desc: 'Créez votre compte en quelques secondes. Le système vous attribue automatiquement votre tableau de bord selon votre rôle.' },
  { num: '02', icon: Map, title: 'Exploration & Signalement', desc: 'Naviguez la carte interactive, consultez les données de votre région et signalez les problèmes en un clic.' },
  { num: '03', icon: Activity, title: 'Traitement & Suivi', desc: 'Les agents et responsables traitent les signalements. Vous suivez chaque étape avec des notifications temps réel.' },
  { num: '04', icon: TrendingUp, title: 'Analyse & Amélioration', desc: 'L\'IA analyse les tendances, prédit les besoins et aide les décideurs à optimiser les ressources publiques.' },
];

const techStack = [
  { icon: Code2, label: 'Next.js 13 + React 18', desc: 'Performance, SEO et rendu hybride' },
  { icon: Database, label: 'Supabase + PostgreSQL + PostGIS', desc: 'Base de données temps réel avec géospatial' },
  { icon: Lock, label: 'Row Level Security + Audit', desc: 'Sécurité au niveau base de données' },
  { icon: Brain, label: 'Edge Functions IA + IoT', desc: 'Intelligence déployée à la périphérie' },
  { icon: Cloud, label: 'Déploiement Cloud Scalable', desc: 'Infrastructure élastique et hautement disponible' },
  { icon: Server, label: 'API REST + Realtime', desc: 'APIs modernes et communication temps réel' },
];

const keyFigures = [
  { value: '99.9%', label: 'Disponibilité', icon: Activity, color: 'text-success' },
  { value: '< 50ms', label: 'Latence API', icon: Zap, color: 'text-primary' },
  { value: '8,500+', label: 'Capteurs IoT', icon: Cpu, color: 'text-chart-2' },
  { value: '10K+/j', label: 'Prédictions IA', icon: Brain, color: 'text-chart-5' },
  { value: '1.2M+', label: 'Signalements traités', icon: Activity, color: 'text-accent' },
  { value: '26', label: 'Provinces connectées', icon: Globe, color: 'text-rdc-sky' },
];

const testimonials = [
  {
    name: 'Grâce Mbuya',
    role: 'Maire de la Commune de Gombe',
    quote: 'La plateforme a transformé notre façon de gérer la commune. Les signalements citoyens sont traités 3x plus rapidement.',
    avatar: 'https://images.pexels.com/photos/5905902/pexels-photo-5905902.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop',
  },
  {
    name: 'Jean-Pierre Kabasele',
    role: 'Directeur Général, Ministère du Numérique',
    quote: 'SMART CITY RDC 2035 est un exemple de ce que la transformation numérique peut apporter à un pays entier.',
    avatar: 'https://images.pexels.com/photos/3785079/pexels-photo-3785079.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop',
  },
  {
    name: 'Aline Lukusa',
    role: 'Citoyenne, Kinshasa',
    quote: 'J\'ai signalé un lampadaire cassé dans ma rue et il a été réparé en 48h. Avant, cela prenait des mois.',
    avatar: 'https://images.pexels.com/photos/5905471/pexels-photo-5905471.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop',
  },
];

const faqs = [
  { q: 'Qui peut utiliser la plateforme SMART CITY RDC 2035 ?', a: 'La plateforme est accessible à tous les citoyens congolais, ainsi qu\'aux agents et responsables des administrations publiques. Chaque utilisateur accède à un tableau de bord adapté à son rôle.' },
  { q: 'Comment créer un signalement citoyen ?', a: 'Connectez-vous à votre espace citoyen, cliquez sur « Nouveau signalement », décrivez le problème, ajoutez une photo si possible et indiquez la localisation. Le système se charge du reste.' },
  { q: 'Mes données sont-elles sécurisées ?', a: 'Oui. La plateforme utilise une sécurité de niveau gouvernemental avec chiffrement, contrôle d\'accès par rôle (RLS) et journalisation complète des actions pour audit.' },
  { q: 'La plateforme couvre-t-elle toutes les provinces ?', a: 'Oui, les 26 provinces de la RDC sont intégrées. Chaque province, territoire et commune dispose de son propre tableau de bord.' },
  { q: 'L\'intelligence artificielle est-elle utilisée ?', a: 'Oui, l\'IA analyse les données en temps réel pour prédire les besoins, optimiser les ressources et détecter les anomalies automatiquement.' },
  { q: 'Puis-je accéder à la plateforme sur mobile ?', a: 'Absolument. La plateforme est entièrement responsive et optimisée pour mobile, tablette et ordinateur.' },
];

export function LandingSections() {
  const { t } = useI18n();

  return (
    <>
      {/* ─── VISION ─── */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-mesh opacity-60" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Eye className="h-3.5 w-3.5" />
              {t('vision.title')}
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {t('vision.subtitle')}
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Une vision audacieuse pour transformer la République Démocratique du Congo
              en une nation numérique de référence en Afrique centrale.
            </p>
          </motion.div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {visionPillars.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6 }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-float"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <p.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-base font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
                <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-0" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SERVICES ─── */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-2xl text-center"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              {t('services.title')}
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Six modules, une plateforme unifiée
            </h2>
            <p className="mt-4 text-muted-foreground">
              {t('services.subtitle')}. Chaque module répond à un besoin spécifique de la
              gestion urbaine moderne.
            </p>
          </motion.div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -6 }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-float"
              >
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${s.bg} ${s.color}`}>
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                <Link
                  href={s.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100"
                >
                  Explorer
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-0" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BENEFITS (Citizens + Government) ─── */}
      <section className="relative overflow-hidden py-24 bg-muted/30">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Des avantages pour tous les acteurs
            </h2>
            <p className="mt-4 text-muted-foreground">
              Que vous soyez citoyen, agent ou décideur, la plateforme vous donne les outils
              pour agir efficacement.
            </p>
          </motion.div>

          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            {/* Citizen benefits */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-border bg-card p-8 shadow-card"
            >
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                  <Users className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-bold">Pour les Citoyens</h3>
                  <p className="text-sm text-muted-foreground">Participez à la vie de votre communauté</p>
                </div>
              </div>
              <ul className="space-y-3">
                {citizenBenefits.map((b, i) => (
                  <motion.li
                    key={b}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    <span className="text-sm">{b}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Government benefits */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-border bg-card p-8 shadow-card"
            >
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-bold">Pour le Gouvernement</h3>
                  <p className="text-sm text-muted-foreground">Pilotez la nation avec des données fiables</p>
                </div>
              </div>
              <ul className="space-y-3">
                {govBenefits.map((b, i) => (
                  <motion.li
                    key={b}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm">{b}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-2xl text-center"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Target className="h-3.5 w-3.5" />
              Fonctionnement
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Comment fonctionne la plateforme
            </h2>
            <p className="mt-4 text-muted-foreground">
              Un processus simple et transparent, du signalement citoyen à la prise de décision gouvernementale.
            </p>
          </motion.div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <s.icon className="h-6 w-6" />
                    </span>
                    <span className="font-display text-3xl font-bold text-muted/30">{s.num}</span>
                  </div>
                  <h3 className="font-display text-base font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="absolute -right-4 top-1/2 hidden -translate-y-1/2 lg:block">
                    <ArrowRight className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TECH STACK ─── */}
      <section className="relative overflow-hidden py-24 bg-muted/30">
        <div className="absolute inset-0 bg-dots opacity-20" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Code2 className="h-3.5 w-3.5" />
                {t('tech.title')}
              </span>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {t('tech.subtitle')}
              </h2>
              <p className="mt-4 text-muted-foreground">
                Construite sur les meilleures technologies du marché, la plateforme SMART CITY RDC 2035
                offre des performances exceptionnelles, une sécurité de niveau gouvernemental et
                une scalabilité nationale.
              </p>
              <div className="mt-8 space-y-4">
                {techStack.map((tech, i) => (
                  <motion.div
                    key={tech.label}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <tech.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{tech.label}</p>
                      <p className="text-xs text-muted-foreground">{tech.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass-card rounded-2xl p-8"
            >
              <div className="grid grid-cols-2 gap-4">
                {keyFigures.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
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
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-2xl text-center"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-foreground">
              <Users className="h-3.5 w-3.5" />
              Témoignages
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Ils utilisent la plateforme
            </h2>
            <p className="mt-4 text-muted-foreground">
              Citoyens, agents et décideurs partagent leur expérience.
            </p>
          </motion.div>

          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            {testimonials.map((tm, i) => (
              <motion.div
                key={tm.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <div className="mb-4 flex items-center gap-3">
                  <img
                    src={tm.avatar}
                    alt={tm.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-display text-sm font-semibold">{tm.name}</p>
                    <p className="text-xs text-muted-foreground">{tm.role}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  « {tm.quote} »
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="relative overflow-hidden py-24 bg-muted/30">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {t('faq.title')}
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {t('faq.subtitle')}
            </h2>
          </motion.div>

          <div className="mt-12 space-y-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={faq.q}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-xl border border-border bg-card p-5 shadow-card"
              >
                <h3 className="font-display text-sm font-semibold sm:text-base">{faq.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
