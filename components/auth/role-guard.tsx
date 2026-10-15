'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/stores/auth-store';
import { canAccessDashboard } from '@/lib/dashboard-roles';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
  dashboard: string;
  children: ReactNode;
}

export function RoleGuard({ dashboard, children }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (!canAccessDashboard(dashboard, user.role)) {
      toast.error('Accès non autorisé', {
        description: 'Vous n\'avez pas les permissions requises pour cette section.',
      });
      router.replace('/dashboard');
      return;
    }

    setAuthorized(true);
  }, [user, loading, dashboard, router]);

  if (loading || !authorized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Vérification des permissions...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
