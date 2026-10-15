'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Check, Trash2, CheckCheck, Filter } from 'lucide-react';
import { DashboardPageHeader, Card } from '@/components/dashboard/dashboard-primitives';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNotifications, type Notification } from '@/lib/stores/notification-store';
import { cn } from '@/lib/utils';
import { RoleGuard } from '@/components/auth/role-guard';

const typeStyles: Record<Notification['type'], string> = {
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
  return `il y a ${Math.floor(h / 24)}j`;
}

const filters = ['Toutes', 'Non lues', 'Lues'];

export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead, remove, clearAll } = useNotifications();
  const [filter, setFilter] = useState('Toutes');

  const filtered = notifications.filter((n) => {
    if (filter === 'Non lues') return !n.read;
    if (filter === 'Lues') return n.read;
    return true;
  });

  return (
    <RoleGuard dashboard="SHARED">
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader
        title="Notifications"
        description="Centre de notifications temps réel"
        icon={Bell}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={!notifications.some((n) => !n.read)}>
              <CheckCheck className="mr-2 h-4 w-4" /> Tout marquer lu
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll} disabled={notifications.length === 0}>
              <Trash2 className="mr-2 h-4 w-4" /> Tout effacer
            </Button>
          </div>
        }
      />

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {filters.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} notification(s)</span>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aucune notification</p>
            </div>
          ) : (
            filtered.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  'group flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50',
                  !n.read && 'bg-primary/5 border-primary/20'
                )}
              >
                <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', typeStyles[n.type])}>
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {!n.read && (
                        <button onClick={() => markAsRead(n.id)} className="rounded-md p-1.5 hover:bg-muted" title="Marquer lu">
                          <Check className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                      <button onClick={() => remove(n.id)} className="rounded-md p-1.5 hover:bg-muted" title="Supprimer">
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{n.category}</span>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </Card>
    </div>
    </RoleGuard>
  );
}
