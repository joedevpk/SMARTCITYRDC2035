'use client';

import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';

export function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary to-primary/70 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute -top-20 right-0 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2.5 text-primary-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/15 backdrop-blur">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-base font-bold">SMART CITY RDC</span>
            <span className="text-[10px] opacity-80">2035 · Gouvernement de la RDC</span>
          </div>
        </Link>
        <div className="relative text-primary-foreground">
          <h2 className="font-display text-3xl font-bold leading-tight">
            La transformation numérique du Congo commence ici.
          </h2>
          <p className="mt-4 max-w-md text-primary-foreground/80">
            Une plateforme nationale intelligente qui connecte le Gouvernement,
            les institutions et les citoyens pour une gestion urbaine moderne.
          </p>
        </div>
        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Gouvernement de la RDC. Tous droits réservés.
        </p>
      </div>

      <div className="flex min-h-screen flex-col px-4 py-6 sm:px-6 lg:min-h-0 lg:justify-center lg:py-12">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="font-display text-sm font-bold">SMART CITY RDC</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher compact />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto w-full max-w-md">
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
