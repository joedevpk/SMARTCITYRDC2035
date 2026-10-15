'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, Wifi, WifiOff, AlertTriangle, Activity, Battery, RefreshCw,
  Lightbulb, Trash2, Droplets, Zap, TrafficCone, Camera, Radio,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { RoleGuard } from '@/components/auth/role-guard';
import { SimulationBadge } from '@/components/dashboard/data-provenance';
import { toast } from 'sonner';

type DeviceType = 'streetlight' | 'waste_bin' | 'water_meter' | 'energy_meter' | 'traffic_light' | 'camera' | 'air_sensor' | 'noise_sensor' | 'flood_sensor';
type DeviceStatus = 'online' | 'offline' | 'warning' | 'error' | 'maintenance';

interface IoTDevice {
  id: string;
  device_id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  battery_level: number | null;
  last_seen: string | null;
  lat: number;
  lng: number;
  commune_id: string | null;
  metadata: Record<string, any>;
  is_simulated: boolean;
}

interface TelemetryPoint {
  id: number;
  device_id: string;
  metric: string;
  value: number;
  unit: string;
  recorded_at: string;
  is_simulated: boolean;
}

const typeIcon: Record<DeviceType, typeof Cpu> = {
  streetlight: Lightbulb,
  waste_bin: Trash2,
  water_meter: Droplets,
  energy_meter: Zap,
  traffic_light: TrafficCone,
  camera: Camera,
  air_sensor: Activity,
  noise_sensor: Radio,
  flood_sensor: AlertTriangle,
};

const typeColor: Record<DeviceType, string> = {
  streetlight: 'text-yellow-500',
  waste_bin: 'text-green-500',
  water_meter: 'text-cyan-500',
  energy_meter: 'text-amber-500',
  traffic_light: 'text-blue-500',
  camera: 'text-purple-500',
  air_sensor: 'text-teal-500',
  noise_sensor: 'text-orange-500',
  flood_sensor: 'text-red-500',
};

const statusColor: Record<DeviceStatus, string> = {
  online: 'bg-success/15 text-success border-success/30',
  offline: 'bg-muted text-muted-foreground border-border',
  warning: 'bg-warning/15 text-warning border-warning/30',
  error: 'bg-destructive/15 text-destructive border-destructive/30',
  maintenance: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
};

const typeLabel: Record<DeviceType, string> = {
  streetlight: 'Lampadaires',
  waste_bin: 'Bacs déchets',
  water_meter: 'Compteurs eau',
  energy_meter: 'Compteurs énergie',
  traffic_light: 'Feux de circulation',
  camera: 'Caméras',
  air_sensor: 'Capteurs air',
  noise_sensor: 'Capteurs bruit',
  flood_sensor: 'Capteurs inondation',
};

const PIE_COLORS = ['#eab308', '#22c55e', '#06b6d4', '#f59e0b', '#3b82f6', '#a855f7', '#14b8a6', '#f97316', '#ef4444'];

export default function IoTDashboard() {
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [filterType, setFilterType] = useState<DeviceType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<DeviceStatus | 'all'>('all');

  useEffect(() => {
    loadDevices();
    loadTelemetry();

    // Subscribe to realtime telemetry
    const channel = supabase
      .channel('iot-telemetry')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'iot_telemetry' }, (payload) => {
        setTelemetry((prev) => [payload.new as TelemetryPoint, ...prev].slice(0, 100));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'iot_devices' }, (payload) => {
        setDevices((prev) => prev.map((d) => d.id === (payload.new as IoTDevice).id ? payload.new as IoTDevice : d));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadDevices() {
    const { data } = await supabase.rpc('get_iot_devices_with_coords');
    if (data) setDevices(data as IoTDevice[]);
    setLoading(false);
  }

  async function loadTelemetry() {
    const { data } = await supabase
      .from('iot_telemetry')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(50);
    if (data) setTelemetry(data as TelemetryPoint[]);
  }

  async function runSimulation() {
    setSimulating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Session expirée'); setSimulating(false); return; }
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      const res = await fetch(`${supabaseUrl}/functions/v1/iot-ingest/simulate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: anonKey },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error('Simulation refusée', { description: body.message ?? body.error ?? `HTTP ${res.status}` });
      } else {
        toast.success(`${body.simulated} mesure(s) SIMULÉE(S) créée(s)`, { description: 'Elles sont étiquetées et exclues des indicateurs réels.' });
        await loadDevices();
        await loadTelemetry();
      }
    } catch {
      toast.error('Simulation impossible', { description: 'Fonction injoignable (non déployée, CORS ou réseau).' });
    }
    setSimulating(false);
  }

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    devices.forEach((d) => {
      byType[d.type] = (byType[d.type] || 0) + 1;
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    });
    return { byType, byStatus, total: devices.length, online: byStatus.online || 0, offline: (byStatus.offline || 0) + (byStatus.error || 0) };
  }, [devices]);

  const pieData = useMemo(() => {
    return Object.entries(stats.byType).map(([name, value]) => ({ name: typeLabel[name as DeviceType] || name, value }));
  }, [stats]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (filterType !== 'all' && d.type !== filterType) return false;
      if (filterStatus !== 'all' && d.status !== filterStatus) return false;
      return true;
    });
  }, [devices, filterType, filterStatus]);

  const telemetryChartData = useMemo(() => {
    const grouped: Record<string, { time: string; value: number }[]> = {};
    telemetry.slice(0, 30).reverse().forEach((t) => {
      const key = t.metric;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ time: new Date(t.recorded_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), value: t.value });
    });
    return grouped;
  }, [telemetry]);

  const metricColors: Record<string, string> = {
    luminance: '#eab308', fill_level: '#22c55e', flow_rate: '#06b6d4', power: '#f59e0b', vehicle_count: '#3b82f6', phase: '#a855f7',
  };

  return (
    <RoleGuard dashboard="SHARED">
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader
        title="IoT — Objets connectés"
        description="Appareils réels (authentifiés) et appareils simulés, clairement séparés"
        icon={Cpu}
        actions={
          <Button onClick={runSimulation} disabled={simulating}>
            {simulating ? (
              <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Simulation...</>
            ) : (
              <><Radio className="mr-2 h-4 w-4" /> Générer des mesures SIMULÉES</>
            )}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Cpu, label: 'Appareils réels', value: devices.filter((d) => !d.is_simulated).length, color: 'text-primary' },
          { icon: Radio, label: 'Appareils simulés', value: devices.filter((d) => d.is_simulated).length, color: 'text-warning' },
          { icon: Wifi, label: 'En ligne', value: stats.online, color: 'text-success' },
          { icon: WifiOff, label: 'Hors ligne', value: stats.offline, color: 'text-destructive' },
          { icon: Activity, label: 'Télémétrie (30s)', value: telemetry.length, color: 'text-chart-2' },
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
          <SectionTitle title="Dernières mesures reçues" action={telemetry.some((t) => t.is_simulated) ? <SimulationBadge label="CONTIENT DES MESURES SIMULÉES" /> : <Badge variant="secondary">Réelles</Badge>} />
          {Object.keys(telemetryChartData).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucune mesure. Aucun appareil réel n’a transmis de données ; la simulation (désactivable) peut être lancée par un administrateur pour une démonstration.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(telemetryChartData).slice(0, 4).map(([metric, data]) => (
                <div key={metric}>
                  <p className="mb-1 text-xs font-medium text-muted-foreground capitalize">{metric.replace(/_/g, ' ')}</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={metricColors[metric] || 'hsl(var(--primary))'} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={metricColors[metric] || 'hsl(var(--primary))'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="value" stroke={metricColors[metric] || 'hsl(var(--primary))'} fill={`url(#grad-${metric})`} strokeWidth={2} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Répartition par type" />
          {pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucun appareil</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ value }: { value: number }) => value} labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle
          title="Appareils connectés"
          action={
            <div className="flex flex-wrap gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as DeviceType | 'all')}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs"
              >
                <option value="all">Tous types</option>
                {(Object.keys(typeLabel) as DeviceType[]).map((t) => <option key={t} value={t}>{typeLabel[t]}</option>)}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as DeviceStatus | 'all')}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs"
              >
                <option value="all">Tous statuts</option>
                <option value="online">En ligne</option>
                <option value="offline">Hors ligne</option>
                <option value="warning">Alerte</option>
                <option value="error">Erreur</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          }
        />
        {loading ? (
          <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/50" />)}</div>
        ) : filteredDevices.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun appareil ne correspond aux filtres.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDevices.slice(0, 30).map((d, i) => {
              const Icon = typeIcon[d.type] || Cpu;
              return (
                <motion.div key={d.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn('flex h-8 w-8 items-center justify-center rounded-md bg-muted', typeColor[d.type])}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{d.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{d.device_id} {d.is_simulated && <SimulationBadge />}</p>
                      </div>
                    </div>
                    <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[10px]', statusColor[d.status])}>{d.status}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Battery className="h-3 w-3" />
                      {d.battery_level !== null ? `${d.battery_level}%` : 'N/A'}
                    </span>
                    {d.last_seen && <span>{new Date(d.last_seen).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                  {d.metadata && Object.keys(d.metadata).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(d.metadata).slice(0, 3).map(([k, v]) => (
                        <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{k}: {String(v)}</span>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
    </RoleGuard>
  );
}
