'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, ShieldCheck, ShieldAlert, Activity, Lock, Key, AlertTriangle,
  RefreshCw, Eye, Download, Clock, MapPin, User,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { RoleGuard } from '@/components/auth/role-guard';

interface SecurityEvent {
  id: number;
  event_type: string;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, any>;
  severity: string;
  created_at: string;
}

interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

const severityColor: Record<string, string> = {
  info: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
};

const eventTypeLabel: Record<string, string> = {
  failed_login: 'Connexion échouée',
  successful_login: 'Connexion réussie',
  account_locked: 'Compte verrouillé',
  password_change: 'Mot de passe modifié',
  role_change: 'Changement de rôle',
  permission_grant: 'Permission accordée',
  permission_revoke: 'Permission révoquée',
  suspicious_activity: 'Activité suspecte',
  rate_limit_exceeded: 'Limite de débit dépassée',
  api_key_used: 'Clé API utilisée',
  data_export: 'Export de données',
};

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#ef4444'];

export default function SecurityDashboard() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [eventsRes, auditRes] = await Promise.all([
      supabase.from('security_events').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (eventsRes.data) setEvents(eventsRes.data as SecurityEvent[]);
    if (auditRes.data) setAuditLog(auditRes.data as AuditEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = {
    total: events.length,
    critical: events.filter((e) => e.severity === 'critical').length,
    warnings: events.filter((e) => e.severity === 'warning').length,
    failedLogins: events.filter((e) => e.event_type === 'failed_login').length,
  };

  const byType = events.reduce((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = [
    { name: 'Info', value: events.filter((e) => e.severity === 'info').length },
    { name: 'Alerte', value: stats.warnings },
    { name: 'Critique', value: stats.critical },
  ].filter((d) => d.value > 0);

  const filteredEvents = filter === 'all' ? events : events.filter((e) => e.severity === filter);

  return (
    <RoleGuard dashboard="SHARED">
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader
        title="Sécurité & Audit"
        description="Centre de sécurité — événements, journaux d'audit et surveillance"
        icon={Shield}
        actions={
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Actualiser
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Activity, label: 'Événements totaux', value: stats.total, color: 'text-primary' },
          { icon: ShieldCheck, label: 'Sécurisé', value: stats.total - stats.critical - stats.warnings, color: 'text-success' },
          { icon: AlertTriangle, label: 'Alertes', value: stats.warnings, color: 'text-warning' },
          { icon: ShieldAlert, label: 'Critiques', value: stats.critical, color: 'text-destructive' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-5">
            <s.icon className={cn('h-10 w-10', s.color)} />
            <div>
              <p className="font-display text-2xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Événements de sécurité" action={
            <div className="flex gap-1">
              {['all', 'info', 'warning', 'critical'].map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn('rounded-md border px-2.5 py-1 text-xs transition-colors', filter === f ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>
                  {f === 'all' ? 'Tous' : f === 'info' ? 'Info' : f === 'warning' ? 'Alerte' : 'Critique'}
                </button>
              ))}
            </div>
          } />
          {loading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/50" />)}</div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-8 text-center">
              <ShieldCheck className="mx-auto mb-2 h-10 w-10 text-success" />
              <p className="text-sm text-muted-foreground">Aucun événement de sécurité</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredEvents.map((e, i) => (
                <motion.div key={e.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', severityColor[e.severity])}>
                    {e.severity === 'critical' ? <ShieldAlert className="h-4 w-4" /> : e.severity === 'warning' ? <AlertTriangle className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{eventTypeLabel[e.event_type] || e.event_type}</p>
                      <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[10px]', severityColor[e.severity])}>{e.severity}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(e.created_at).toLocaleString('fr-FR')}</span>
                      {e.ip_address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.ip_address}</span>}
                      {e.user_id && <span className="flex items-center gap-1"><User className="h-3 w-3" />{e.user_id.slice(0, 8)}...</span>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Répartition par sévérité" />
          {pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ value }: { value: number }) => value}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle title="Journal d'audit" action={<Badge variant="secondary">{auditLog.length} entrées</Badge>} />
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/50" />)}</div>
        ) : auditLog.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucune entrée d&rsquo;audit</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Action</th>
                  <th className="pb-2 font-medium">Entité</th>
                  <th className="pb-2 font-medium">IP</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.slice(0, 20).map((a) => (
                  <tr key={a.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 font-medium">{a.action}</td>
                    <td className="py-2.5 text-muted-foreground">{a.entity_type || '—'}</td>
                    <td className="py-2.5 text-muted-foreground">{a.ip_address || '—'}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Lock, label: 'Verrouillage auto', value: '5 tentatives', desc: 'Verrouillage après 5 échecs / 15 min' },
          { icon: Key, label: 'Clés API actives', value: '—', desc: 'Gestion des intégrations externes' },
          { icon: Eye, label: 'Surveillance', value: '24/7', desc: 'Audit continu des actions sensibles' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="rounded-xl border border-border bg-card p-4">
            <s.icon className="mb-2 h-8 w-8 text-primary" />
            <p className="font-display text-lg font-bold">{s.value}</p>
            <p className="text-sm font-medium">{s.label}</p>
            <p className="text-xs text-muted-foreground">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
    </RoleGuard>
  );
}
