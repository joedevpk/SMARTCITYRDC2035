'use client';

import { motion } from 'framer-motion';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down';
  icon: LucideIcon;
  color?: string;
  bg?: string;
  delay?: number;
}

export function KpiCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  color = 'text-primary',
  bg = 'bg-primary/10',
  delay = 0,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-soft transition-all hover:shadow-float"
    >
      {/* Hover gradient glow */}
      <div className={cn('absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-100', bg)} />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 font-display text-2xl font-bold">{value}</p>
        </div>
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg transition-transform group-hover:scale-110', bg, color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {change && (
        <div className="relative mt-3 flex items-center gap-1.5 text-xs">
          {trend === 'up' ? (
            <TrendingUp className="h-3.5 w-3.5 text-success" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className={trend === 'up' ? 'font-medium text-success' : 'font-medium text-destructive'}>{change}</span>
          <span className="text-muted-foreground">vs mois dernier</span>
        </div>
      )}
    </motion.div>
  );
}
