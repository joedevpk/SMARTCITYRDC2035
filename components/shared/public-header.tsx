'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useOverlay } from '@/lib/hooks/use-overlay';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, Building2, ChevronDown, Search, Globe,
  Bell, User, LogOut, Settings, LayoutDashboard, FileText,
  Map, Cpu, Brain, ShieldCheck, Zap, Droplets, Trash2,
  TrafficCone, Users, Landmark, Home as HomeIcon, Target,
} from 'lucide-react';
import { useI18n } from '@/lib/stores/i18n-store';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  key: string;
  href: string;
  label: string;
  mega?: { title: string; href: string; desc: string; icon: typeof Map }[];
}

const navItems: NavItem[] = [
  { key: 'nav.home', href: '/', label: 'Accueil' },
  {
    key: 'nav.platform',
    href: '/vision',
    label: 'Plateforme',
    mega: [
      { title: 'Vision', href: '/vision', desc: 'Notre vision pour 2035', icon: HomeIcon },
      { title: 'Mission', href: '/mission', desc: 'Notre mission nationale', icon: Target },
      { title: 'Services', href: '/services', desc: 'Services publics intelligents', icon: Zap },
      { title: 'Technologies', href: '/technologies', desc: 'Architecture technique', icon: Cpu },
    ],
  },
  {
    key: 'nav.modules',
    href: '/dashboard',
    label: 'Modules',
    mega: [
      { title: 'Carte Interactive', href: '/dashboard/map', desc: 'GIS temps réel', icon: Map },
      { title: 'IoT & Capteurs', href: '/dashboard/iot', desc: 'Objets connectés', icon: Cpu },
      { title: 'Intelligence IA', href: '/dashboard/ai', desc: 'Prédictions & analyses', icon: Brain },
      { title: 'Sécurité & Audit', href: '/dashboard/security', desc: 'Cybersécurité', icon: ShieldCheck },
      { title: 'Signalements', href: '/dashboard/reports', desc: 'Gestion citoyenne', icon: FileText },
      { title: 'Notifications', href: '/dashboard/notifications', desc: 'Alertes temps réel', icon: Bell },
    ],
  },
  {
    key: 'nav.institution',
    href: '/partners',
    label: 'Institution',
    mega: [
      { title: 'Partenaires', href: '/partners', desc: 'Nos partenaires officiels', icon: Users },
      { title: 'Contact', href: '/contact', desc: 'Nous contacter', icon: Globe },
      { title: 'FAQ', href: '/faq', desc: 'Questions fréquentes', icon: FileText },
    ],
  },
];

export function PublicHeader() {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fermer tous les panneaux à chaque navigation, et le menu mobile si l'écran devient large.
  useEffect(() => { setMobileOpen(false); setSearchOpen(false); setMegaOpen(null); }, [pathname]);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => { if (mq.matches) setMobileOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useOverlay(mobileOpen, () => setMobileOpen(false), mobilePanelRef);
  useOverlay(searchOpen, () => setSearchOpen(false), searchPanelRef);

  // Recherche réelle : filtre les pages publiques et modules existants (aucune suggestion factice).
  const destinations = useMemo(() => {
    const list: { title: string; href: string; desc?: string }[] = [];
    for (const item of navItems) {
      list.push({ title: item.label, href: item.href });
      for (const m of item.mega ?? []) list.push({ title: m.title, href: m.href, desc: m.desc });
    }
    const seen = new Set<string>();
    return list.filter((d) => (seen.has(d.href) ? false : (seen.add(d.href), true)));
  }, []);
  const normalize = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return destinations.slice(0, 6);
    return destinations.filter((d) => normalize(`${d.title} ${d.desc ?? ''}`).includes(q));
  }, [query, destinations]);

  const closeAll = () => { setMobileOpen(false); setSearchOpen(false); };
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition-all duration-300',
          scrolled || mobileOpen ? 'glass shadow-lg' : 'bg-transparent'
        )}
      >
        {/* DRC flag accent bar */}
        <div className="absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r from-sky-500 via-yellow-400 to-red-600 opacity-50" />

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="group flex min-w-0 items-center gap-2.5" aria-label="SMART CITY RDC 2035 — accueil">
            <motion.div
              whileHover={{ rotate: 360, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md"
            >
              <Building2 className="h-5 w-5" />
              <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/20" />
            </motion.div>
            <div className="flex min-w-0 flex-col leading-none">
              <span className="truncate font-display text-sm font-bold tracking-tight">SMART CITY RDC</span>
              <span className="hidden text-[10px] font-medium text-muted-foreground sm:block">
                2035 · Gouvernement de la RDC
              </span>
            </div>
          </Link>

          {/* Desktop nav with mega menu (souris, clavier et focus) */}
          <nav
            aria-label="Navigation principale"
            className="relative hidden items-center gap-1 lg:flex"
            onMouseLeave={() => setMegaOpen(null)}
            onBlur={(e) => { if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setMegaOpen(null); }}
          >
            {navItems.map((item, idx) => (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={() => setMegaOpen(item.mega ? idx : null)}
              >
                <Link
                  href={item.href}
                  onFocus={() => setMegaOpen(item.mega ? idx : null)}
                  aria-haspopup={item.mega ? 'true' : undefined}
                  aria-expanded={item.mega ? megaOpen === idx : undefined}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground',
                    isActive(item.href) ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {item.label}
                  {item.mega && (
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', megaOpen === idx && 'rotate-180')} />
                  )}
                </Link>
              </div>
            ))}
          </nav>

          {/* Mega menu panel */}
          <AnimatePresence>
            {megaOpen !== null && navItems[megaOpen]?.mega && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute left-1/2 top-[calc(4rem+env(safe-area-inset-top))] hidden -translate-x-1/2 lg:block"
                onMouseEnter={() => setMegaOpen(megaOpen)}
                onMouseLeave={() => setMegaOpen(null)}
              >
                <div className="glass-card w-[min(560px,calc(100vw-2rem))] rounded-2xl p-6 shadow-2xl">
                  <div className="grid grid-cols-2 gap-3">
                    {navItems[megaOpen]!.mega!.map((m) => (
                      <Link
                        key={m.href}
                        href={m.href}
                        className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          <m.icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-medium">{m.title}</p>
                          <p className="text-xs text-muted-foreground">{m.desc}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Right side actions */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={() => { setMobileOpen(false); setSearchOpen(true); }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted lg:h-9 lg:w-9"
              aria-label="Rechercher sur la plateforme"
              aria-haspopup="dialog"
            >
              <Search className="h-4 w-4" />
            </button>

            <LanguageSwitcher compact />
            <ThemeToggle />

            <div className="ml-2 hidden items-center gap-2 md:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t('nav.login')}</Link>
              </Button>
              <Button asChild size="sm" className="shadow-md">
                <Link href="/register">{t('nav.register')}</Link>
              </Button>
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="ml-0.5 inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted lg:hidden"
              aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileOpen}
              aria-controls="menu-mobile"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu : panneau défilable, jamais plus haut que l'écran */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              id="menu-mobile"
              ref={mobilePanelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu principal"
              tabIndex={-1}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="glass max-h-[calc(100dvh-4rem-env(safe-area-inset-top))] overflow-y-auto overscroll-contain border-t border-border outline-none lg:hidden"
            >
              <nav aria-label="Menu mobile" className="space-y-1 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
                {navItems.map((item) => (
                  <div key={item.href} className="pb-1">
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={pathname === item.href ? 'page' : undefined}
                      className={cn(
                        'flex min-h-[44px] items-center rounded-md px-3 text-sm font-semibold transition-colors hover:bg-muted',
                        isActive(item.href) ? 'bg-muted text-primary' : 'text-foreground'
                      )}
                    >
                      {item.label}
                    </Link>
                    {item.mega && (
                      <div className="ml-3 space-y-0.5 border-l border-border pl-2">
                        {item.mega.map((m) => (
                          <Link
                            key={m.href}
                            href={m.href}
                            onClick={() => setMobileOpen(false)}
                            aria-current={pathname === m.href ? 'page' : undefined}
                            className={cn(
                              'flex min-h-[44px] items-center gap-2 rounded-md px-3 text-sm hover:bg-muted',
                              pathname === m.href ? 'text-primary' : 'text-muted-foreground'
                            )}
                          >
                            <m.icon className="h-4 w-4 shrink-0" />
                            {m.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2 pt-3">
                  <Button asChild variant="outline" className="h-11">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>{t('nav.login')}</Link>
                  </Button>
                  <Button asChild className="h-11">
                    <Link href="/register" onClick={() => setMobileOpen(false)}>{t('nav.register')}</Link>
                  </Button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Recherche : hors de <header> (un parent avec backdrop-filter piégerait ce panneau « fixed » dans la barre) */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              ref={searchPanelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Recherche"
              tabIndex={-1}
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              className="mx-auto mt-[calc(1rem+env(safe-area-inset-top))] w-full max-w-2xl px-3 outline-none sm:mt-24 sm:px-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass-strong max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-4 shadow-2xl sm:p-6">
                <div className="flex items-center gap-3">
                  <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher une page ou un module…"
                    aria-label="Rechercher une page ou un module"
                    enterKeyHint="go"
                    className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-lg"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && results[0]) { closeAll(); setQuery(''); router.push(results[0].href); }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setSearchOpen(false)}
                    aria-label="Fermer la recherche"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-muted"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {query.trim() ? `${results.length} résultat(s)` : 'Pages principales'}
                  </p>
                  {results.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">Aucune page ne correspond à « {query.trim()} ».</p>
                  ) : (
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {results.map((r) => (
                        <li key={r.href}>
                          <Link
                            href={r.href}
                            onClick={() => { closeAll(); setQuery(''); }}
                            className="flex min-h-[44px] flex-col justify-center rounded-lg px-3 py-1.5 hover:bg-muted"
                          >
                            <span className="text-sm font-medium">{r.title}</span>
                            {r.desc && <span className="text-xs text-muted-foreground">{r.desc}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
