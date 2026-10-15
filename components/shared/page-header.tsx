'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-mesh pt-28 pb-16">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          {badge && (
            <span className="mb-4 inline-block rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium backdrop-blur">
              {badge}
            </span>
          )}
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 text-lg text-muted-foreground">{subtitle}</p>
          )}
          {children}
        </motion.div>
      </div>
    </section>
  );
}
