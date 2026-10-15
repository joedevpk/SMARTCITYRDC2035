'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Users, Database, Activity, Server, AlertTriangle, CheckCircle2,
  Search, MoreVertical, Plus, Pencil, Trash2, X, Power, MapPin, FileText,
  Newspaper, Bell, Cpu, MapPinned, Loader2,
} from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { RoleGuard } from '@/components/auth/role-guard';
import { supabase } from '@/lib/supabase/client';
import { type UserRole, roleLabels } from '@/lib/stores/auth-store';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type TabKey = 'overview' | 'users' | 'provinces' | 'communes' | 'reports' | 'news' | 'iot' | 'gis';

const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'overview', label: 'Vue d\'ensemble', icon: Activity },
  { key: 'users', label: 'Utilisateurs', icon: Users },
  { key: 'provinces', label: 'Provinces', icon: MapPin },
  { key: 'communes', label: 'Communes', icon: Database },
  { key: 'reports', label: 'Signalements', icon: FileText },
  { key: 'news', label: 'Actualités', icon: Newspaper },
  { key: 'iot', label: 'IoT', icon: Cpu },
  { key: 'gis', label: 'GIS', icon: MapPinned },
];

const allRoles: UserRole[] = [
  'admin', 'government', 'ministry', 'province', 'commune',
  'police', 'emergency', 'water', 'energy', 'waste', 'transport', 'agent', 'citizen',
];

const reportStatuses = ['pending', 'validated', 'assigned', 'in_progress', 'resolved'];
const reportStatusLabels: Record<string, string> = {
  pending: 'En attente', validated: 'Validé', assigned: 'Assigné',
  in_progress: 'En cours', resolved: 'Résolu',
};

// ─── Overview tab ─────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState({
    users: 0, reports: 0, provinces: 0, communes: 0, news: 0, iot: 0, gis: 0, events: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [users, reports, provinces, communes, news, iot, gis, events] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('reports').select('id', { count: 'exact', head: true }),
        supabase.from('provinces').select('id', { count: 'exact', head: true }),
        supabase.from('communes').select('id', { count: 'exact', head: true }),
        supabase.from('news_articles').select('id', { count: 'exact', head: true }),
        supabase.from('iot_devices').select('id', { count: 'exact', head: true }),
        supabase.from('gis_points').select('id', { count: 'exact', head: true }),
        supabase.from('security_events').select('event_type, severity, created_at, details').order('created_at', { ascending: false }).limit(6),
      ]);
      setStats({
        users: users.count || 0,
        reports: reports.count || 0,
        provinces: provinces.count || 0,
        communes: communes.count || 0,
        news: news.count || 0,
        iot: iot.count || 0,
        gis: gis.count || 0,
        events: events.count || 0,
      });
      setRecentEvents(events.data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Users} title="Utilisateurs" value={String(stats.users)} color="text-primary" delay={0} />
        <KpiCard icon={FileText} title="Signalements" value={String(stats.reports)} color="text-chart-3" delay={0.05} />
        <KpiCard icon={MapPin} title="Provinces" value={String(stats.provinces)} color="text-chart-2" delay={0.1} />
        <KpiCard icon={Database} title="Communes" value={String(stats.communes)} color="text-success" delay={0.15} />
        <KpiCard icon={Newspaper} title="Actualités" value={String(stats.news)} color="text-warning" delay={0.2} />
        <KpiCard icon={Cpu} title="Capteurs IoT" value={String(stats.iot)} color="text-chart-4" delay={0.25} />
        <KpiCard icon={MapPinned} title="Points GIS" value={String(stats.gis)} color="text-primary" delay={0.3} />
        <KpiCard icon={Shield} title="Événements sécurité" value={String(stats.events)} color="text-destructive" delay={0.35} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Journal de sécurité" />
          <div className="space-y-2">
            {recentEvents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucun événement récent</p>
            ) : (
              recentEvents.map((e, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3"
                >
                  {e.severity === 'warning' && <AlertTriangle className="h-4 w-4 text-warning" />}
                  {e.severity === 'info' && <Activity className="h-4 w-4 text-primary" />}
                  {e.severity === 'critical' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  {!['warning', 'info', 'critical'].includes(e.severity) && <CheckCircle2 className="h-4 w-4 text-success" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{e.event_type}</p>
                    <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Card>

        <ServiceStatusCard />
      </div>
    </div>
  );
}


// ─── Real service probes (no hard-coded "Opérationnel") ─────────
type ProbeState = { state: 'checking' | 'ok' | 'degraded' | 'down'; detail?: string };

function ServiceStatusCard() {
  const [probes, setProbes] = useState<Record<string, ProbeState>>({
    'API Gateway': { state: 'checking' },
    'AI Service': { state: 'checking' },
    'IoT Ingest': { state: 'checking' },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { Authorization: `Bearer ${session?.access_token ?? ''}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' };
      const probe = async (name: string, path: string, map?: (j: any) => ProbeState) => {
        let result: ProbeState;
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 8000);
          const res = await fetch(`${base}/functions/v1/${path}`, { headers, signal: ctrl.signal });
          clearTimeout(t);
          if (!res.ok) result = { state: 'down', detail: `HTTP ${res.status}` };
          else result = map ? map(await res.json()) : { state: 'ok' };
        } catch {
          result = { state: 'down', detail: 'injoignable (fonction non déployée ou réseau)' };
        }
        if (!cancelled) setProbes((p) => ({ ...p, [name]: result }));
      };
      if (!base) { setProbes({ 'API Gateway': { state: 'down', detail: 'backend non configuré' }, 'AI Service': { state: 'down', detail: 'backend non configuré' }, 'IoT Ingest': { state: 'down', detail: 'backend non configuré' } }); return; }
      await Promise.all([
        probe('API Gateway', 'api-gateway/health'),
        probe('AI Service', 'ai-service/status', (j) => j.llm_configured ? { state: 'ok', detail: `LLM : ${j.model}` } : { state: 'degraded', detail: 'IA non configurée (statistiques uniquement)' }),
        probe('IoT Ingest', 'iot-ingest/stats', (j) => j.real_devices > 0 ? { state: 'ok', detail: `${j.real_devices} appareil(s) réel(s)` } : { state: 'degraded', detail: 'aucun appareil réel enregistré' }),
      ]);
    })();
    return () => { cancelled = true; };
  }, []);

  const color = { checking: 'text-muted-foreground', ok: 'text-success', degraded: 'text-warning', down: 'text-destructive' } as const;
  const label = { checking: 'Vérification…', ok: 'Joignable', degraded: 'Partiel', down: 'Indisponible' } as const;
  return (
    <Card>
      <SectionTitle title="État des services (vérifié maintenant)" />
      <div className="space-y-3">
        {Object.entries(probes).map(([name, p]) => (
          <div key={name} className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm font-medium">{name}</span>
            <span className={`text-right text-sm font-semibold ${color[p.state]}`}>
              {label[p.state]}
              {p.detail && <span className="block text-xs font-normal text-muted-foreground">{p.detail}</span>}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Users tab ────────────────────────────────────────────────
interface ProfileRow {
  id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  phone: string | null;
  created_at: string;
  province: { name: string } | null;
}

function UsersTab() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editUser, setEditUser] = useState<ProfileRow | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('citizen');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('id, full_name, role, is_active, phone, created_at, province:provinces(name)')
      .order('created_at', { ascending: false });

    if (roleFilter !== 'all') {
      query = query.eq('role', roleFilter);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Erreur', { description: 'Impossible de charger les utilisateurs.' });
    } else {
      setUsers((data || []) as unknown as ProfileRow[]);
    }
    setLoading(false);
  }, [roleFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (u.phone || '').includes(search)
  );

  const handleRoleChange = async () => {
    if (!editUser) return;
    const { error } = await supabase.rpc('admin_update_user_role', {
      p_user_id: editUser.id,
      p_new_role: editRole,
    });
    if (error) {
      toast.error('Erreur', { description: 'Impossible de modifier le rôle.' });
    } else {
      toast.success('Rôle modifié', { description: `${editUser.full_name} est maintenant ${roleLabels[editRole]?.fr}` });
      setEditUser(null);
      loadUsers();
    }
  };

  const toggleActive = async (user: ProfileRow) => {
    const { error } = await supabase.rpc('admin_toggle_user_active', {
      p_user_id: user.id,
      p_active: !user.is_active,
    });
    if (error) {
      toast.error('Erreur', { description: 'Impossible de modifier le statut.' });
    } else {
      toast.success(user.is_active ? 'Compte désactivé' : 'Compte activé', { description: user.full_name });
      loadUsers();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou téléphone..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrer par rôle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {allRoles.map((r) => (
              <SelectItem key={r} value={r}>{roleLabels[r]?.fr}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        {loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} message="Aucun utilisateur trouvé" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Nom</th>
                  <th className="pb-2 font-medium">Rôle</th>
                  <th className="pb-2 font-medium">Téléphone</th>
                  <th className="pb-2 font-medium">Statut</th>
                  <th className="pb-2 font-medium">Province</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 font-medium">{u.full_name}</td>
                    <td className="py-3">
                      <Badge variant="outline">{roleLabels[u.role]?.fr || u.role}</Badge>
                    </td>
                    <td className="py-3 text-muted-foreground">{u.phone || '—'}</td>
                    <td className="py-3">
                      <span className={cn(
                        'inline-block rounded-full border px-2 py-0.5 text-xs',
                        u.is_active
                          ? 'bg-success/15 text-success border-success/30'
                          : 'bg-destructive/15 text-destructive border-destructive/30'
                      )}>
                        {u.is_active ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">{u.province?.name || '—'}</td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setEditUser(u); setEditRole(u.role); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleActive(u)}
                        >
                          <Power className={cn('h-3.5 w-3.5', u.is_active ? 'text-warning' : 'text-success')} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit role dialog */}
      <Dialog open={!!editUser} onOpenChange={(v) => !v && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le rôle — {editUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Nouveau rôle</Label>
            <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allRoles.map((r) => (
                  <SelectItem key={r} value={r}>{roleLabels[r]?.fr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Annuler</Button>
            <Button onClick={handleRoleChange}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Provinces tab ─────────────────────────────────────────────
interface ProvinceRow {
  id: string;
  name: string;
  code: string;
  capital: string | null;
  population: number | null;
}

function ProvincesTab() {
  const [provinces, setProvinces] = useState<ProvinceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProvinceRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', capital: '', population: '0' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('provinces')
      .select('id, name, code, capital, population')
      .order('name');
    if (error) {
      toast.error('Erreur', { description: 'Impossible de charger les provinces.' });
    } else {
      setProvinces(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name || !form.code) {
      toast.error('Champs requis', { description: 'Le nom et le code sont obligatoires.' });
      return;
    }
    const payload = {
      name: form.name,
      code: form.code,
      capital: form.capital || null,
      population: parseInt(form.population) || 0,
    };
    if (editing) {
      const { error } = await supabase.from('provinces').update(payload).eq('id', editing.id);
      if (error) {
        toast.error('Erreur', { description: error.message });
        return;
      }
      toast.success('Province modifiée');
    } else {
      const { error } = await supabase.from('provinces').insert(payload);
      if (error) {
        toast.error('Erreur', { description: error.message });
        return;
      }
      toast.success('Province ajoutée');
    }
    setShowForm(false);
    setEditing(null);
    setForm({ name: '', code: '', capital: '', population: '0' });
    load();
  };

  const handleDelete = async (p: ProvinceRow) => {
    if (!confirm(`Supprimer la province "${p.name}" ?`)) return;
    const { error } = await supabase.from('provinces').delete().eq('id', p.id);
    if (error) {
      toast.error('Erreur', { description: 'Impossible de supprimer. Vérifiez les dépendances.' });
    } else {
      toast.success('Province supprimée');
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setForm({ name: '', code: '', capital: '', population: '0' }); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Ajouter
        </Button>
      </div>
      <Card>
        {loading ? <LoadingState /> : provinces.length === 0 ? (
          <EmptyState icon={MapPin} message="Aucune province" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Nom</th>
                  <th className="pb-2 font-medium">Code</th>
                  <th className="pb-2 font-medium">Capitale</th>
                  <th className="pb-2 font-medium">Population</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {provinces.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 font-mono text-xs">{p.code}</td>
                    <td className="py-3 text-muted-foreground">{p.capital || '—'}</td>
                    <td className="py-3">{(p.population || 0).toLocaleString('fr-FR')}</td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setEditing(p); setForm({ name: p.name, code: p.code, capital: p.capital || '', population: String(p.population || 0) }); setShowForm(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(p)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={showForm} onOpenChange={(v) => !v && setShowForm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la province' : 'Nouvelle province'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Kinshasa" />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="KIN" />
            </div>
            <div className="space-y-2">
              <Label>Capitale</Label>
              <Input value={form.capital} onChange={(e) => setForm({ ...form, capital: e.target.value })} placeholder="Kinshasa" />
            </div>
            <div className="space-y-2">
              <Label>Population</Label>
              <Input type="number" value={form.population} onChange={(e) => setForm({ ...form, population: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button onClick={handleSave}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Communes tab ──────────────────────────────────────────────
interface CommuneRow {
  id: string;
  name: string;
  population: number | null;
  province: { name: string } | null;
  province_id: string;
}

function CommunesTab() {
  const [communes, setCommunes] = useState<CommuneRow[]>([]);
  const [provinces, setProvinces] = useState<ProvinceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CommuneRow | null>(null);
  const [form, setForm] = useState({ name: '', province_id: '', population: '0' });

  const load = useCallback(async () => {
    setLoading(true);
    const [communesRes, provRes] = await Promise.all([
      supabase.from('communes').select('id, name, population, province_id, province:provinces(name)').order('name'),
      supabase.from('provinces').select('id, name').order('name'),
    ]);
    if (communesRes.error) {
      toast.error('Erreur', { description: 'Impossible de charger les communes.' });
    } else {
      setCommunes((communesRes.data || []) as unknown as CommuneRow[]);
    }
    setProvinces((provRes.data as unknown as ProvinceRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name || !form.province_id) {
      toast.error('Champs requis', { description: 'Le nom et la province sont obligatoires.' });
      return;
    }
    const payload = {
      name: form.name,
      province_id: form.province_id,
      population: parseInt(form.population) || 0,
    };
    if (editing) {
      const { error } = await supabase.from('communes').update(payload).eq('id', editing.id);
      if (error) { toast.error('Erreur', { description: error.message }); return; }
      toast.success('Commune modifiée');
    } else {
      const { error } = await supabase.from('communes').insert(payload);
      if (error) { toast.error('Erreur', { description: error.message }); return; }
      toast.success('Commune ajoutée');
    }
    setShowForm(false);
    setEditing(null);
    setForm({ name: '', province_id: '', population: '0' });
    load();
  };

  const handleDelete = async (c: CommuneRow) => {
    if (!confirm(`Supprimer la commune "${c.name}" ?`)) return;
    const { error } = await supabase.from('communes').delete().eq('id', c.id);
    if (error) {
      toast.error('Erreur', { description: 'Impossible de supprimer. Vérifiez les dépendances.' });
    } else {
      toast.success('Commune supprimée');
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setForm({ name: '', province_id: '', population: '0' }); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Ajouter
        </Button>
      </div>
      <Card>
        {loading ? <LoadingState /> : communes.length === 0 ? (
          <EmptyState icon={Database} message="Aucune commune" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Nom</th>
                  <th className="pb-2 font-medium">Province</th>
                  <th className="pb-2 font-medium">Population</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {communes.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 font-medium">{c.name}</td>
                    <td className="py-3 text-muted-foreground">{c.province?.name || '—'}</td>
                    <td className="py-3">{(c.population || 0).toLocaleString('fr-FR')}</td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setEditing(c); setForm({ name: c.name, province_id: c.province_id, population: String(c.population || 0) }); setShowForm(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(c)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={showForm} onOpenChange={(v) => !v && setShowForm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la commune' : 'Nouvelle commune'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Gombe" />
            </div>
            <div className="space-y-2">
              <Label>Province</Label>
              <Select value={form.province_id} onValueChange={(v) => setForm({ ...form, province_id: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {provinces.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Population</Label>
              <Input type="number" value={form.population} onChange={(e) => setForm({ ...form, population: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button onClick={handleSave}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Reports tab ───────────────────────────────────────────────
interface ReportRow {
  id: string;
  reference: string | null;
  title: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  commune: { name: string } | null;
}

function ReportsTab() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [editReport, setEditReport] = useState<ReportRow | null>(null);
  const [editStatus, setEditStatus] = useState('pending');

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('reports')
      .select('id, reference, title, category, status, priority, created_at, commune:communes(name)')
      .order('created_at', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (error) {
      toast.error('Erreur', { description: 'Impossible de charger les signalements.' });
    } else {
      setReports((data || []) as unknown as ReportRow[]);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async () => {
    if (!editReport) return;
    const { error } = await supabase.from('reports').update({ status: editStatus, updated_at: new Date().toISOString() }).eq('id', editReport.id);
    if (error) {
      toast.error('Erreur', { description: error.message });
    } else {
      toast.success('Statut mis à jour');
      setEditReport(null);
      load();
    }
  };

  const handleDelete = async (r: ReportRow) => {
    if (!confirm(`Supprimer le signalement "${r.title}" ?`)) return;
    const { error } = await supabase.from('reports').delete().eq('id', r.id);
    if (error) {
      toast.error('Erreur', { description: error.message });
    } else {
      toast.success('Signalement supprimé');
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {reportStatuses.map((s) => <SelectItem key={s} value={s}>{reportStatusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card>
        {loading ? <LoadingState /> : reports.length === 0 ? (
          <EmptyState icon={FileText} message="Aucun signalement" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Référence</th>
                  <th className="pb-2 font-medium">Titre</th>
                  <th className="pb-2 font-medium">Catégorie</th>
                  <th className="pb-2 font-medium">Statut</th>
                  <th className="pb-2 font-medium">Commune</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 font-mono text-xs">{r.reference || '—'}</td>
                    <td className="py-3 font-medium">{r.title}</td>
                    <td className="py-3"><Badge variant="outline">{r.category}</Badge></td>
                    <td className="py-3">
                      <span className={cn(
                        'inline-block rounded-full border px-2 py-0.5 text-xs',
                        r.status === 'resolved' ? 'bg-success/15 text-success border-success/30' :
                        r.status === 'in_progress' ? 'bg-warning/15 text-warning border-warning/30' :
                        'bg-muted text-muted-foreground border-border'
                      )}>
                        {reportStatusLabels[r.status] || r.status}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">{r.commune?.name || '—'}</td>
                    <td className="py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setEditReport(r); setEditStatus(r.status); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(r)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!editReport} onOpenChange={(v) => !v && setEditReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le statut — {editReport?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Nouveau statut</Label>
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {reportStatuses.map((s) => <SelectItem key={s} value={s}>{reportStatusLabels[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditReport(null)}>Annuler</Button>
            <Button onClick={handleStatusChange}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── News tab ──────────────────────────────────────────────────
interface NewsRow {
  id: string;
  title: string;
  category: string;
  is_published: boolean;
  excerpt: string | null;
  created_at: string;
}

function NewsTab() {
  const [news, setNews] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<NewsRow | null>(null);
  const [form, setForm] = useState({ title: '', category: 'info', excerpt: '', content: '', is_published: true });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('news_articles')
      .select('id, title, category, is_published, excerpt, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Erreur', { description: 'Impossible de charger les actualités.' });
    } else {
      setNews(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.title) { toast.error('Titre requis'); return; }
    const payload = {
      title: form.title,
      category: form.category,
      excerpt: form.excerpt || null,
      content: form.content || form.excerpt || null,
      is_published: form.is_published,
    };
    if (editing) {
      const { error } = await supabase.from('news_articles').update(payload).eq('id', editing.id);
      if (error) { toast.error('Erreur', { description: error.message }); return; }
      toast.success('Article modifié');
    } else {
      const { error } = await supabase.from('news_articles').insert(payload);
      if (error) { toast.error('Erreur', { description: error.message }); return; }
      toast.success('Article créé');
    }
    setShowForm(false);
    setEditing(null);
    setForm({ title: '', category: 'info', excerpt: '', content: '', is_published: true });
    load();
  };

  const togglePublish = async (n: NewsRow) => {
    const { error } = await supabase.from('news_articles').update({ is_published: !n.is_published }).eq('id', n.id);
    if (error) { toast.error('Erreur'); } else { toast.success(n.is_published ? 'Dépublié' : 'Publié'); load(); }
  };

  const handleDelete = async (n: NewsRow) => {
    if (!confirm(`Supprimer "${n.title}" ?`)) return;
    const { error } = await supabase.from('news_articles').delete().eq('id', n.id);
    if (error) { toast.error('Erreur', { description: error.message }); }
    else { toast.success('Article supprimé'); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setForm({ title: '', category: 'info', excerpt: '', content: '', is_published: true }); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nouvel article
        </Button>
      </div>
      <Card>
        {loading ? <LoadingState /> : news.length === 0 ? (
          <EmptyState icon={Newspaper} message="Aucun article" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Titre</th>
                  <th className="pb-2 font-medium">Catégorie</th>
                  <th className="pb-2 font-medium">Statut</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {news.map((n) => (
                  <tr key={n.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 font-medium">{n.title}</td>
                    <td className="py-3"><Badge variant="outline">{n.category}</Badge></td>
                    <td className="py-3">
                      <span className={cn(
                        'inline-block rounded-full border px-2 py-0.5 text-xs',
                        n.is_published ? 'bg-success/15 text-success border-success/30' : 'bg-muted text-muted-foreground border-border'
                      )}>
                        {n.is_published ? 'Publié' : 'Brouillon'}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePublish(n)}>
                          <CheckCircle2 className={cn('h-3.5 w-3.5', n.is_published ? 'text-success' : 'text-muted-foreground')} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => {
                            setEditing(n);
                            setForm({ title: n.title, category: n.category, excerpt: n.excerpt || '', content: '', is_published: n.is_published });
                            setShowForm(true);
                          }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(n)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={showForm} onOpenChange={(v) => !v && setShowForm(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier l\'article' : 'Nouvel article'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="urgence">Urgence</SelectItem>
                  <SelectItem value="annonce">Annonce</SelectItem>
                  <SelectItem value="technologie">Technologie</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Extrait</Label>
              <Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Contenu</Label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button onClick={handleSave}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── IoT tab ───────────────────────────────────────────────────
interface IotRow {
  id: string;
  device_id: string;
  name: string;
  type: string;
  status: string;
  commune: { name: string } | null;
}

function IotTab() {
  const [devices, setDevices] = useState<IotRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('iot_devices')
      .select('id, device_id, name, type, status, commune:communes(name)')
      .order('name');
    if (error) {
      toast.error('Erreur', { description: 'Impossible de charger les appareils.' });
    } else {
      setDevices((data || []) as unknown as IotRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (d: IotRow) => {
    const newStatus = d.status === 'online' ? 'offline' : 'online';
    const { error } = await supabase.from('iot_devices').update({ status: newStatus }).eq('id', d.id);
    if (error) { toast.error('Erreur'); }
    else { toast.success('Statut modifié'); load(); }
  };

  const handleDelete = async (d: IotRow) => {
    if (!confirm(`Supprimer l'appareil "${d.name}" ?`)) return;
    const { error } = await supabase.from('iot_devices').delete().eq('id', d.id);
    if (error) { toast.error('Erreur'); }
    else { toast.success('Appareil supprimé'); load(); }
  };

  return (
    <Card>
      {loading ? <LoadingState /> : devices.length === 0 ? (
        <EmptyState icon={Cpu} message="Aucun appareil IoT" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Nom</th>
                <th className="pb-2 font-medium">ID</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Statut</th>
                <th className="pb-2 font-medium">Commune</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b border-border/50 last:border-0">
                  <td className="py-3 font-medium">{d.name}</td>
                  <td className="py-3 font-mono text-xs">{d.device_id}</td>
                  <td className="py-3"><Badge variant="outline">{d.type}</Badge></td>
                  <td className="py-3">
                    <span className={cn(
                      'inline-block rounded-full border px-2 py-0.5 text-xs',
                      d.status === 'online' ? 'bg-success/15 text-success border-success/30' :
                      d.status === 'warning' ? 'bg-warning/15 text-warning border-warning/30' :
                      'bg-muted text-muted-foreground border-border'
                    )}>
                      {d.status}
                    </span>
                  </td>
                  <td className="py-3 text-muted-foreground">{d.commune?.name || '—'}</td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatus(d)}>
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(d)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── GIS tab ───────────────────────────────────────────────────
interface GisRow {
  id: string;
  name: string;
  category: string;
  commune: { name: string } | null;
}

function GisTab() {
  const [points, setPoints] = useState<GisRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('gis_points')
      .select('id, name, category, commune:communes(name)')
      .order('name');
    if (error) {
      toast.error('Erreur', { description: 'Impossible de charger les points GIS.' });
    } else {
      setPoints((data || []) as unknown as GisRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (g: GisRow) => {
    if (!confirm(`Supprimer le point "${g.name}" ?`)) return;
    const { error } = await supabase.from('gis_points').delete().eq('id', g.id);
    if (error) { toast.error('Erreur'); }
    else { toast.success('Point supprimé'); load(); }
  };

  return (
    <Card>
      {loading ? <LoadingState /> : points.length === 0 ? (
        <EmptyState icon={MapPinned} message="Aucun point GIS" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Nom</th>
                <th className="pb-2 font-medium">Catégorie</th>
                <th className="pb-2 font-medium">Commune</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {points.map((g) => (
                <tr key={g.id} className="border-b border-border/50 last:border-0">
                  <td className="py-3 font-medium">{g.name}</td>
                  <td className="py-3"><Badge variant="outline">{g.category}</Badge></td>
                  <td className="py-3 text-muted-foreground">{g.commune?.name || '—'}</td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(g)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── Shared components ─────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof Users; message: string }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <Icon className="mb-3 h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  return (
    <RoleGuard dashboard="admin">
      <div className="space-y-6 p-4 lg:p-6">
        <DashboardPageHeader
          title="Administration Système"
          description="Gestion complète de la plateforme — utilisateurs, rôles, sécurité"
          icon={Shield}
        />

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'provinces' && <ProvincesTab />}
          {activeTab === 'communes' && <CommunesTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'news' && <NewsTab />}
          {activeTab === 'iot' && <IotTab />}
          {activeTab === 'gis' && <GisTab />}
        </motion.div>
      </div>
    </RoleGuard>
  );
}
