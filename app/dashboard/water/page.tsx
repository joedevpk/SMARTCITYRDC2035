'use client';

import { motion } from 'framer-motion';
import { Droplets, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { RoleGuard } from '@/components/auth/role-guard';
import { DemoDataBanner } from '@/components/dashboard/data-provenance';

export default function WaterDashboard() {
  return (
    <RoleGuard dashboard="water">
      <div className="space-y-6 p-4 lg:p-6">
        <DashboardPageHeader
          title="Service des Eaux"
          description="Réservoirs, consommation, fuites et stations"
          icon={Droplets}
        />
        <DemoDataBanner />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Droplets} title="Consommation (m³)" value="12 480" color="text-primary" />
          <KpiCard icon={AlertTriangle} title="Fuites détectées" value="4" color="text-warning" />
          <KpiCard icon={CheckCircle2} title="Stations actives" value="18" color="text-success" />
          <KpiCard icon={Activity} title="Pression moyenne" value="3.2 bar" color="text-accent" />
        </div>
        <Card>
          <SectionTitle title="Stations de pompage" />
          <div className="space-y-2">
            {[
              { name: 'Station N\'Djili', status: 'Opérationnel', flow: '450 L/min' },
              { name: 'Station Lemba', status: 'Opérationnel', flow: '380 L/min' },
              { name: 'Station Masina', status: 'Maintenance', flow: '0 L/min' },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">Débit: {s.flow}</p>
                </div>
                <span className={`text-sm font-semibold ${s.status === 'Opérationnel' ? 'text-success' : 'text-warning'}`}>{s.status}</span>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </RoleGuard>
  );
}
