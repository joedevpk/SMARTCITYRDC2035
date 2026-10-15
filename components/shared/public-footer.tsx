'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Mail, Phone, MapPin, Globe, Send,
  Facebook, Twitter, Linkedin, Youtube, ArrowRight,
  FileText, Shield, BookOpen, HelpCircle, Server,
  Users, Heart, Activity, Cpu, Zap,
} from 'lucide-react';
import { useI18n } from '@/lib/stores/i18n-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function PublicFooter() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    }
  };

  const socialLinks = [
    { icon: Facebook, href: '#', label: 'Facebook' },
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' },
    { icon: Youtube, href: '#', label: 'YouTube' },
  ];

  const platformLinks = [
    { label: 'Vision', href: '/vision', icon: ArrowRight },
    { label: 'Mission', href: '/mission', icon: ArrowRight },
    { label: 'Services', href: '/services', icon: ArrowRight },
    { label: 'Technologies', href: '/technologies', icon: ArrowRight },
  ];

  const accessLinks = [
    { label: 'Connexion', href: '/login', icon: ArrowRight },
    { label: 'Inscription', href: '/register', icon: ArrowRight },
    { label: 'Tableau de bord', href: '/dashboard', icon: ArrowRight },
    { label: 'FAQ', href: '/faq', icon: ArrowRight },
  ];

  const resourceLinks = [
    { label: 'Documentation', href: '/technologies', icon: BookOpen },
    { label: 'API', href: '/technologies', icon: Server },
    { label: 'Centre d\'aide', href: '/faq', icon: HelpCircle },
    { label: 'Support', href: '/contact', icon: Mail },
  ];

  const legalLinks = [
    { label: 'Mentions légales', href: '/legal' },
    { label: 'Confidentialité', href: '/privacy' },
    { label: 'Conditions d\'utilisation', href: '/terms' },
  ];

  const platformStats = [
    { icon: Users, label: 'Utilisateurs actifs', value: '1.2M+' },
    { icon: Activity, label: 'Signalements traités', value: '1.24M+' },
    { icon: Cpu, label: 'Capteurs IoT', value: '8,500+' },
    { icon: Zap, label: 'Disponibilité', value: '99.9%' },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-border bg-card/50">
      {/* DRC flag-inspired gradient strip */}
      <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-sky-500 via-yellow-400 to-red-600 opacity-40" />

      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-grid opacity-10" />
      <div className="absolute -top-20 right-10 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        {/* Top section: Brand + Newsletter */}
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-display text-base font-bold">SMART CITY RDC</span>
                <span className="text-[11px] text-muted-foreground">2035 · Gouvernement de la RDC</span>
              </div>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              {t('footer.tagline')}. Plateforme nationale intelligente de gestion urbaine,
              connectant le Gouvernement, les Ministères, les Provinces, les Communes et les Citoyens.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-2 pt-2">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Newsletter */}
          <div className="lg:justify-self-end">
            <h4 className="mb-2 font-display text-sm font-semibold">Newsletter officielle</h4>
            <p className="mb-4 max-w-sm text-sm text-muted-foreground">
              Recevez les actualités de la transformation numérique du Congo directement dans votre boîte mail.
            </p>
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <Input
                type="email"
                placeholder="vous@exemple.cd"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="max-w-xs"
                required
              />
              <Button type="submit" size="sm" className="shrink-0">
                {subscribed ? (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>Inscrit!</motion.span>
                ) : (
                  <>
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    S&rsquo;inscrire
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Links grid */}
        <div className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h4 className="mb-4 font-display text-sm font-semibold">Plateforme</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {platformLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="group flex items-center gap-1.5 transition-colors hover:text-foreground">
                    <l.icon className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-display text-sm font-semibold">Accès</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {accessLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="group flex items-center gap-1.5 transition-colors hover:text-foreground">
                    <l.icon className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-display text-sm font-semibold">Ressources</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {resourceLinks.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="group flex items-center gap-1.5 transition-colors hover:text-foreground">
                    <l.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-display text-sm font-semibold">Contact</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Avenue du Peuple, Kinshasa Gombe, RDC</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <span>+243 80 000 0000</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                <span>contact@smartcity-rdc.cd</span>
              </li>
              <li className="flex items-center gap-2">
                <Globe className="h-4 w-4 shrink-0 text-primary" />
                <span>www.smartcity-rdc.cd</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Platform stats */}
        <div className="mt-12 grid grid-cols-2 gap-4 border-t border-border pt-8 sm:grid-cols-4">
          {platformStats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="text-center"
            >
              <s.icon className="mx-auto mb-1.5 h-5 w-5 text-primary" />
              <p className="font-display text-lg font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {year} Gouvernement de la République Démocratique du Congo. {t('footer.rights')}.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {legalLinks.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Made with love */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <span>Conçu avec</span>
          <Heart className="h-3 w-3 fill-red-500 text-red-500" />
          <span>pour le peuple congolais · SMART CITY RDC 2035</span>
        </div>
      </div>
    </footer>
  );
}
