'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Map, FileText, Bell, User, Settings, LogOut,
  Building2, Shield, Users, Landmark, Home, X,
  Cpu, Brain, ShieldCheck, Sparkles, Newspaper,
  Droplets, Zap, Trash2, Bus, Siren, HardHat, ChevronRight,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useDashboardNav } from '@/lib/stores/nav-store';
import { useOverlay } from '@/lib/hooks/use-overlay';
import { useI18n } from '@/lib/stores/i18n-store';
import { useAuth, type UserRole, roleLabels } from '@/lib/stores/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItem {
  key: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { key: 'dash.overview', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'government', 'ministry', 'province', 'commune', 'police', 'emergency', 'water', 'energy', 'waste', 'transport', 'agent'] },
  { key: 'dash.map', href: '/dashboard/map', icon: Map, roles: ['admin', 'government', 'ministry', 'province', 'commune', 'police', 'emergency', 'water', 'energy', 'waste', 'transport', 'agent', 'citizen'] },
  { key: 'dash.reports', href: '/dashboard/reports', icon: FileText, roles: ['admin', 'government', 'ministry', 'province', 'commune', 'police', 'emergency', 'water', 'energy', 'waste', 'transport', 'agent', 'citizen'] },
  { key: 'dash.iot', href: '/dashboard/iot', icon: Cpu, roles: ['admin', 'government', 'ministry', 'province', 'commune', 'water', 'energy', 'waste', 'transport'] },
  { key: 'dash.ai', href: '/dashboard/ai', icon: Brain, roles: ['admin', 'government', 'ministry', 'province', 'commune'] },
  { key: 'dash.security', href: '/dashboard/security', icon: ShieldCheck, roles: ['admin', 'government', 'police', 'emergency'] },
  { key: 'dash.assistant', href: '/dashboard/assistant', icon: Sparkles, roles: ['admin', 'government', 'ministry', 'province', 'commune', 'police', 'emergency', 'water', 'energy', 'waste', 'transport', 'agent', 'citizen'] },
  { key: 'dash.news', href: '/dashboard/news', icon: Newspaper, roles: ['admin', 'government', 'ministry', 'province', 'commune', 'police', 'emergency', 'water', 'energy', 'waste', 'transport', 'agent', 'citizen'] },
  { key: 'dash.notifications', href: '/dashboard/notifications', icon: Bell, roles: ['admin', 'government', 'ministry', 'province', 'commune', 'police', 'emergency', 'water', 'energy', 'waste', 'transport', 'agent', 'citizen'] },
  { key: 'dash.profile', href: '/dashboard/profile', icon: User, roles: ['admin', 'government', 'ministry', 'province', 'commune', 'police', 'emergency', 'water', 'energy', 'waste', 'transport', 'agent', 'citizen'] },
  { key: 'dash.settings', href: '/dashboard/settings', icon: Settings, roles: ['admin', 'government'] },
];

const dashboards: NavItem[] = [
  { key: 'dash.admin', href: '/dashboard/admin', icon: Shield, roles: ['admin'] },
  { key: 'dash.presidential', href: '/dashboard/presidential', icon: Landmark, roles: ['admin', 'government'] },
  { key: 'dash.national', href: '/dashboard/national', icon: Shield, roles: ['admin', 'government', 'ministry'] },
  { key: 'dash.government', href: '/dashboard/government', icon: Building2, roles: ['admin', 'government', 'ministry'] },
  { key: 'dash.ministry', href: '/dashboard/ministry', icon: Building2, roles: ['admin', 'ministry'] },
  { key: 'dash.province', href: '/dashboard/province', icon: Users, roles: ['admin', 'government', 'ministry', 'province'] },
  { key: 'dash.commune', href: '/dashboard/commune', icon: Home, roles: ['admin', 'province', 'commune'] },
  { key: 'dash.police', href: '/dashboard/police', icon: ShieldCheck, roles: ['admin', 'police'] },
  { key: 'dash.emergency', href: '/dashboard/emergency', icon: Siren, roles: ['admin', 'emergency', 'police'] },
  { key: 'dash.water', href: '/dashboard/water', icon: Droplets, roles: ['admin', 'water'] },
  { key: 'dash.energy', href: '/dashboard/energy', icon: Zap, roles: ['admin', 'energy'] },
  { key: 'dash.waste', href: '/dashboard/waste', icon: Trash2, roles: ['admin', 'waste'] },
  { key: 'dash.transport', href: '/dashboard/transport', icon: Bus, roles: ['admin', 'transport'] },
  { key: 'dash.agent', href: '/dashboard/agent', icon: HardHat, roles: ['admin', 'agent', 'commune', 'province'] },
  { key: 'dash.citizen', href: '/dashboard/citizen', icon: User, roles: ['citizen', 'agent'] },
];

function NavLink({
  item,
  active,
  onClick,
  label,
  layoutPrefix,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
  label: string;
  layoutPrefix: string;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm lg:min-h-0 font-medium transition-all duration-200',
        active
          ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {active && (
        <motion.span
          layoutId={`${layoutPrefix}-active`}
          className="absolute -left-4 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        />
      )}
      <item.icon className={cn('h-4 w-4 transition-transform group-hover:scale-110', active && 'scale-110')} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active ? (
        <ChevronRight className="h-3.5 w-3.5 opacity-70" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-30" />
      )}
    </Link>
  );
}

function SidebarContent({ layoutPrefix, onNavigate }: { layoutPrefix: string; onNavigate?: () => void }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const visibleNavItems = navItems.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
  const visibleDashboards = dashboards.filter((d) => !d.roles || (user && d.roles.includes(user.role)));
  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
  return (
    <div className="flex h-full flex-col">
      {/* Logo header */}
      <Link href="/dashboard" className="group flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-6 pr-14"
        onClick={onNavigate}>
        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md transition-transform group-hover:scale-105">
          <Building2 className="h-5 w-5" />
          <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/20" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-display text-sm font-bold tracking-tight">SMART CITY RDC</span>
          <span className="text-[10px] font-medium text-muted-foreground">2035 · Gouvernement</span>
        </div>
      </Link>

      <nav aria-label="Navigation du tableau de bord" className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4">
        {visibleNavItems.length > 0 && (
          <div>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Navigation
            </p>
            <div className="space-y-0.5">
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(item.href)}
                  onClick={onNavigate}
                  layoutPrefix={layoutPrefix}
                  label={t(item.key as never)}
                />
              ))}
            </div>
          </div>
        )}

        {visibleDashboards.length > 0 && (
          <div>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tableaux de bord
            </p>
            <div className="space-y-0.5">
              {visibleDashboards.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(item.href)}
                  onClick={onNavigate}
                  layoutPrefix={layoutPrefix}
                  label={t(item.key as never)}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User card + logout */}
      <div className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {user && (
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-muted/50 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-sm font-semibold text-primary-foreground shadow-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {roleLabels[user.role]?.fr}
              </p>
            </div>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={async () => {
            onNavigate?.();
            await signOut();
            window.location.href = '/login';
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t('dash.logout')}
        </Button>
      </div>
    </div>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const { mobileOpen, setMobileOpen } = useDashboardNav();
  const panelRef = useRef<HTMLElement>(null);
  const close = () => setMobileOpen(false);

  useOverlay(mobileOpen, close, panelRef);

  // Ferme le tiroir à chaque changement de page, et s'il reste ouvert quand on passe en affichage ordinateur.
  useEffect(() => { setMobileOpen(false); }, [pathname, setMobileOpen]);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => { if (mq.matches) setMobileOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [setMobileOpen]);

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card/50 backdrop-blur-sm lg:block">
        <SidebarContent layoutPrefix="desktop" />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden">
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.aside
              key="drawer"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navigation"
              tabIndex={-1}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 h-[100dvh] w-[min(18rem,calc(100vw-3rem))] bg-card pt-[env(safe-area-inset-top)] shadow-2xl outline-none"
            >
              <button
                type="button"
                onClick={close}
                aria-label="Fermer le menu"
                className="absolute right-2 top-[calc(0.5rem+env(safe-area-inset-top))] z-10 inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent layoutPrefix="mobile" onNavigate={close} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
