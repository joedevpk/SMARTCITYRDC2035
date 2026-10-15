'use client';

import { FlaskConical, DatabaseZap, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Provenance labels used across dashboards (requirement "zéro fausse donnée").
 *  - DemoDataBanner: figures on the page are illustrative and NOT read from the database.
 *  - SimulationBadge: inline marker for simulated / demo rows.
 *  - EmptyState: explicit "no data" state with a reason and an optional next step.
 */
export function DemoDataBanner({ detail }: { detail?: string }) {
  return (
    <div role="note" className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div>
        <p className="font-semibold uppercase tracking-wide text-warning">Données de démonstration — SIMULATION</p>
        <p className="text-muted-foreground">
          {detail ?? 'Les valeurs de cette page sont illustratives : elles ne proviennent d’aucun capteur ni d’aucune base de données et ne décrivent pas la situation réelle.'}
        </p>
      </div>
    </div>
  );
}

export function SimulationBadge({ className, label = 'SIMULATION' }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded border border-warning/50 bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning', className)}>
      {label}
    </span>
  );
}

export function EmptyState({ title, reason, action }: { title: string; reason: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
      <DatabaseZap className="h-7 w-7 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{reason}</p>
      {action}
    </div>
  );
}

export function SourceNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5" /> {children}
    </p>
  );
}
