'use client';

import { motion } from 'framer-motion';
import { Building2, FileText, CheckCircle2, Clock } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { RoleGuard } from '@/components/auth/role-guard';
import { DemoDataBanner } from '@/components/dashboard/data-provenance';

export default function MinistryDashboard() {
  return (
    <RoleGuard dashboard="ministry">
      <div className="space-y-6 p-4 lg:p-6">
        <DashboardPageHeader
          title="Espace Ministériel"
          description="Gestion des dossiers et rapports de votre ministère"
          icon={Building2}
        />
        <DemoDataBanner />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={FileText} title="Dossiers en cours" value="34" color="text-primary" />
          <KpiCard icon={CheckCircle2} title="Dossiers traités" value="156" color="text-success" />
          <KpiCard icon={Clock} title="En attente" value="8" color="text-warning" />
          <KpiCard icon={Building2} title="Services actifs" value="12" color="text-accent" />
        </div>
        <Card>
          <SectionTitle title="Dossiers récents" />
          <div className="space-y-2">
            {['Infrastructure routière', 'Plan de numérisation', 'Budget Q3 2026', 'Audit sécurité'].map((d, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <span className="text-sm font-medium">{d}</span>
                <span className="text-xs text-muted-foreground">En cours</span>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </RoleGuard>
  );
}
