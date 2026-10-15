'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, Check, Trash2, CheckCheck, Menu, X } from 'lucide-react';
import { useDashboardNav } from '@/lib/stores/nav-store';
import { useI18n } from '@/lib/stores/i18n-store';
import { useNotifications } from '@/lib/stores/notification-store';
import { useAuth, roleLabels } from '@/lib/stores/auth-store';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const typeStyles = {
  info: 'bg-blue-500/10 text-blue-500',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-destructive/10 text-destructive',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

export function DashboardTopbar() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const { notifications, markAsRead, markAllAsRead, remove, load, subscribe, loaded } = useNotifications();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const { mobileOpen, setMobileOpen } = useDashboardNav();
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (user?.id && !loaded) {
      load(user.id);
    }
  }, [user?.id, loaded, load]);

  useEffect(() => {
    if (user?.id) {
      const unsub = subscribe(user.id);
      return unsub;
    }
  }, [user?.id, subscribe]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (searchOpen) mobileSearchRef.current?.focus();
  }, [searchOpen]);

  const submitSearch = () => {
    if (!query.trim()) return;
    router.push(`/dashboard/reports?q=${encodeURIComponent(query.trim())}`);
    setQuery('');
    setSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-card/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
    <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-6">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir le menu"
        aria-expanded={mobileOpen}
        aria-haspopup="dialog"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-muted lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <span className="min-w-0 truncate font-display text-sm font-bold tracking-tight sm:hidden">SMART CITY RDC</span>
      <div className="hidden min-w-0 flex-1 sm:block">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitSearch();
            }}
            aria-label={t('common.search')}
            className="pl-9"
          />
          </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
        <button
          type="button"
          onClick={() => setSearchOpen((o) => !o)}
          aria-label="Rechercher"
          aria-expanded={searchOpen}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-muted sm:hidden"
        >
          {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </button>
        <LanguageSwitcher compact />
        <ThemeToggle />

        <div ref={ref} className="sm:relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-muted sm:h-9 sm:w-9"
            aria-label={unread > 0 ? `Notifications (${unread} non lues)` : 'Notifications'}
            aria-expanded={open}
            aria-haspopup="true"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
              >
                {unread}
              </motion.span>
            )}
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="fixed inset-x-2 top-[calc(4.25rem+env(safe-area-inset-top))] z-50 overflow-hidden rounded-xl border border-border bg-popover shadow-premium sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
              >
                <div className="flex items-center justify-between border-b border-border p-3">
                  <p className="font-display text-sm font-semibold">
                    Notifications {unread > 0 && `(${unread})`}
                  </p>
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Tout marquer lu
                  </button>
                </div>
                <div className="max-h-[min(24rem,calc(100dvh-12rem))] overflow-y-auto overscroll-contain">
                  {notifications.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      Aucune notification
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          'group flex gap-3 border-b border-border/50 p-3 transition-colors hover:bg-muted/50',
                          !n.read && 'bg-primary/5'
                        )}
                      >
                        <span className={cn('mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', typeStyles[n.type])}>
                          <Bell className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{n.title}</p>
                            <button
                              type="button"
                              onClick={() => remove(n.id)}
                              aria-label="Supprimer la notification"
                              className="-m-2 p-2 opacity-100 transition-opacity focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                            {!n.read && (
                              <button
                                onClick={() => markAsRead(n.id)}
                                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                              >
                                <Check className="h-3 w-3" />
                                Marquer lu
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button
                  onClick={() => {
                    setOpen(false);
                    router.push('/dashboard/notifications');
                  }}
                  className="w-full border-t border-border p-3 text-center text-sm font-medium text-primary transition-colors hover:bg-muted"
                >
                  Voir tout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {user && (
          <button
            type="button"
            onClick={() => router.push('/dashboard/profile')}
            aria-label="Mon profil"
            className="flex h-11 items-center gap-2 rounded-lg p-1 transition-colors hover:bg-muted sm:ml-1 sm:h-auto"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-sm font-semibold text-primary-foreground shadow-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden text-left sm:block">
              <p className="max-w-[10rem] truncate text-xs font-medium leading-none">{user.name}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {roleLabels[user.role]?.fr}
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
    {searchOpen && (
      <div className="border-t border-border px-3 py-2 sm:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={mobileSearchRef}
            placeholder={t('common.search')}
            aria-label={t('common.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitSearch();
              if (e.key === 'Escape') setSearchOpen(false);
            }}
            enterKeyHint="search"
            className="h-11 pl-9"
          />
        </div>
      </div>
    )}
    </header>
  );
}
