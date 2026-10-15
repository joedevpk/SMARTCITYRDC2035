'use client';

import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Map as MapIcon, TrafficCone, Trash2, Lightbulb, Camera, HeartPulse, Shield, Droplets, Zap,
  AlertTriangle, Search, RefreshCw, X, MapPin, WifiOff, FileWarning, Cpu,
} from 'lucide-react';
import { DashboardPageHeader, Card } from '@/components/dashboard/dashboard-primitives';
import { SimulationBadge, SourceNote } from '@/components/dashboard/data-provenance';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { RoleGuard } from '@/components/auth/role-guard';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then((m) => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });
const ClickCapture = dynamic(() => import('./click-capture'), { ssr: false });

type Source = 'gis' | 'report' | 'iot';

interface MapPoint {
  id: string;
  source: Source;
  group: string; // category / report priority / device type
  name: string;
  description: string;
  lat: number;
  lng: number;
  status?: string;
  isDemo: boolean;
  reference?: string;
}

const gisConfig: Record<string, { label: string; icon: typeof MapIcon; color: string }> = {
  traffic: { label: 'Trafic', icon: TrafficCone, color: '#3b82f6' },
  waste: { label: 'Déchets', icon: Trash2, color: '#22c55e' },
  light: { label: 'Lampadaires', icon: Lightbulb, color: '#eab308' },
  camera: { label: 'Caméras', icon: Camera, color: '#a855f7' },
  hospital: { label: 'Hôpitaux', icon: HeartPulse, color: '#ef4444' },
  police: { label: 'Police', icon: Shield, color: '#6366f1' },
  water: { label: 'Eau', icon: Droplets, color: '#06b6d4' },
  power: { label: 'Électricité', icon: Zap, color: '#f59e0b' },
  incident: { label: 'Incidents', icon: AlertTriangle, color: '#f97316' },
};
const priorityColor: Record<string, string> = { critical: '#dc2626', high: '#f97316', medium: '#eab308', low: '#64748b' };
const sourceMeta: Record<Source, { label: string; icon: typeof MapIcon; color: string }> = {
  gis: { label: 'Points d’intérêt (SIG)', icon: MapPin, color: '#3b82f6' },
  report: { label: 'Signalements citoyens', icon: FileWarning, color: '#dc2626' },
  iot: { label: 'Appareils IoT', icon: Cpu, color: '#10b981' },
};

const KINSHASA_CENTER: [number, number] = [-4.325, 15.3];
const validCoord = (lat: unknown, lng: unknown) =>
  typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

export default function MapPage() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [offline, setOffline] = useState(false);
  const [tileErrors, setTileErrors] = useState(0);
  const [activeSources, setActiveSources] = useState<Set<Source>>(new Set<Source>(['gis', 'report', 'iot']));
  const [hideDemo, setHideDemo] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const errs: string[] = [];
    const all: MapPoint[] = [];

    const [gis, reports, iot] = await Promise.all([
      supabase.rpc('get_gis_points_with_coords'),
      supabase.rpc('get_reports_with_coords'),
      supabase.rpc('get_iot_devices_with_coords'),
    ]);

    if (gis.error) errs.push(`Points d’intérêt : ${gis.error.message}`);
    else for (const p of (gis.data ?? []) as any[]) {
      if (!validCoord(p.lat, p.lng)) continue; // never invent a position
      all.push({ id: `gis-${p.id}`, source: 'gis', group: String(p.category), name: p.name, description: p.description ?? '',
        lat: p.lat, lng: p.lng, status: p.status ?? undefined, isDemo: Boolean(p.is_demo) });
    }
    if (reports.error) errs.push(`Signalements : ${reports.error.message}`);
    else for (const r of (reports.data ?? []) as any[]) {
      if (!validCoord(r.lat, r.lng)) continue;
      all.push({ id: `rep-${r.id}`, source: 'report', group: String(r.priority), name: r.title, description: r.address ?? '',
        lat: r.lat, lng: r.lng, status: r.status, isDemo: Boolean(r.is_demo), reference: r.reference });
    }
    if (iot.error) errs.push(`Appareils IoT : ${iot.error.message}`);
    else for (const d of (iot.data ?? []) as any[]) {
      if (!validCoord(d.lat, d.lng)) continue;
      all.push({ id: `iot-${d.id}`, source: 'iot', group: String(d.type), name: d.name, description: `${d.device_id} · ${d.type}`,
        lat: d.lat, lng: d.lng, status: d.status, isDemo: Boolean(d.is_simulated) });
    }
    setPoints(all);
    setErrors(errs);
    setLastLoaded(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured) load();
    else { setLoading(false); setErrors(['Backend non configuré : aucune donnée à afficher.']); }
  }, [load]);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(typeof navigator !== 'undefined' && !navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return points.filter((p) =>
      activeSources.has(p.source) && !(hideDemo && p.isDemo) &&
      (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || (p.reference ?? '').toLowerCase().includes(q)));
  }, [points, activeSources, hideDemo, query]);

  const colorOf = (p: MapPoint) =>
    p.source === 'gis' ? gisConfig[p.group]?.color ?? '#64748b' : p.source === 'report' ? priorityColor[p.group] ?? '#64748b' : '#10b981';

  const toggleSource = (s: Source) =>
    setActiveSources((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  const countOf = (s: Source) => points.filter((p) => p.source === s).length;

  return (
    <RoleGuard dashboard="SHARED">
      <div className="space-y-4 p-4 lg:p-6">
        <DashboardPageHeader
          title="Carte interactive"
          description="Données géographiques enregistrées en base — chaque marqueur correspond à une ligne identifiable"
          icon={MapIcon}
          actions={
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} /> Actualiser
            </Button>
          }
        />

        {offline && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <WifiOff className="h-4 w-4" /> Vous êtes hors ligne : le fond de carte et les données peuvent ne pas se charger.
          </div>
        )}
        {tileErrors > 5 && (
          <div role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            Le fournisseur de tuiles OpenStreetMap ne répond pas ({tileErrors} erreurs). Les marqueurs restent valides ; le fond de carte est indisponible.
          </div>
        )}
        {errors.map((e) => (
          <div key={e} role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{e}</div>
        ))}

        <div className="grid gap-4 lg:grid-cols-4">
          <Card className="lg:col-span-1">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Rechercher sur la carte" placeholder="Nom, adresse, référence…" value={query}
                  onChange={(e) => setQuery(e.target.value)} className="pl-9" />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sources</p>
                {(Object.keys(sourceMeta) as Source[]).map((s) => {
                  const m = sourceMeta[s];
                  return (
                    <button key={s} type="button" onClick={() => toggleSource(s)} aria-pressed={activeSources.has(s)}
                      className={cn('flex w-full items-center justify-between rounded-lg border p-2.5 text-sm transition-colors',
                        activeSources.has(s) ? 'border-border bg-card' : 'border-border/50 opacity-50')}>
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted"><m.icon className="h-4 w-4" style={{ color: m.color }} /></span>
                        {m.label}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">{countOf(s)}</Badge>
                    </button>
                  );
                })}
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={hideDemo} onChange={(e) => setHideDemo(e.target.checked)} />
                Masquer les données de démonstration
              </label>

              <div className="space-y-1.5 border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Légende</p>
                {Object.entries(gisConfig).map(([k, c]) => (
                  <div key={k} className="flex items-center gap-2 text-xs"><span className="h-3 w-3 rounded-full" style={{ background: c.color }} />{c.label}</div>
                ))}
                {Object.entries(priorityColor).map(([k, c]) => (
                  <div key={k} className="flex items-center gap-2 text-xs"><span className="h-3 w-3 rounded-full ring-2 ring-offset-1" style={{ background: c, boxShadow: `0 0 0 2px ${c}55` }} />Signalement · {k}</div>
                ))}
                <div className="flex items-center gap-2 text-xs"><span className="h-3 w-3 rounded-full border-2 border-dashed border-warning" />Contour pointillé = démonstration</div>
              </div>

              {picked && (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                  <p className="font-medium">Position choisie</p>
                  <p className="text-xs text-muted-foreground">{picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}</p>
                  <Button asChild size="sm" className="mt-2 w-full">
                    <Link href={`/dashboard/reports/new?lat=${picked.lat.toFixed(6)}&lng=${picked.lng.toFixed(6)}`}>Signaler un problème ici</Link>
                  </Button>
                </div>
              )}
              <SourceNote>Fond de carte © OpenStreetMap. Les signalements, appareils et points viennent de la base de données de la plateforme, pas d’OpenStreetMap.</SourceNote>
            </div>
          </Card>

          <Card className="overflow-hidden p-0 lg:col-span-3">
            <div className="relative h-[600px] w-full">
              {loading && (
                <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-card/60">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-lg border border-border bg-card/95 px-4 py-2 text-sm shadow">
                  Aucun élément géolocalisé à afficher avec ces filtres.
                </div>
              )}
              <MapContainer center={KINSHASA_CENTER} zoom={12} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  eventHandlers={{ tileerror: () => setTileErrors((n) => n + 1), tileload: () => setTileErrors(0) }}
                />
                <ClickCapture onPick={(lat, lng) => setPicked({ lat, lng })} />
                {filtered.map((p) => (
                  <CircleMarker
                    key={p.id}
                    center={[p.lat, p.lng]}
                    radius={p.source === 'report' ? 9 : 7}
                    pathOptions={{ color: p.isDemo ? '#d97706' : colorOf(p), fillColor: colorOf(p), fillOpacity: 0.75,
                      weight: p.isDemo ? 3 : 2, dashArray: p.isDemo ? '4 3' : undefined }}
                    eventHandlers={{ click: () => setSelected(p) }}
                  >
                    <Popup>
                      <div className="min-w-[180px] text-sm">
                        <p className="font-semibold">{p.name}</p>
                        {p.reference && <p className="text-xs">{p.reference}</p>}
                        <p className="text-muted-foreground">{p.description}</p>
                        {p.status && <p className="mt-1 text-xs">Statut : {p.status}</p>}
                        {p.isDemo && <p className="mt-1 text-xs font-bold text-amber-600">SIMULATION / DÉMONSTRATION</p>}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground">
          {filtered.length} élément(s) affiché(s) sur {points.length}
          {lastLoaded && ` · actualisé à ${lastLoaded.toLocaleTimeString('fr-FR')}`}
          {' · '}Cliquez sur la carte pour choisir l’emplacement d’un signalement.
        </p>

        {selected && (
          <Card className="fixed bottom-4 right-4 z-[1100] w-full max-w-sm shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display font-semibold">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{sourceMeta[selected.source].label}</p>
              </div>
              <button type="button" aria-label="Fermer" onClick={() => setSelected(null)} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            {selected.description && <p className="mt-2 text-sm text-muted-foreground">{selected.description}</p>}
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</span>
              <span className="flex items-center gap-2">
                {selected.isDemo && <SimulationBadge />}
                {selected.status && <Badge variant="secondary">{selected.status}</Badge>}
              </span>
            </div>
          </Card>
        )}
      </div>
    </RoleGuard>
  );
}
