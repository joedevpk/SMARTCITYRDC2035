'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useI18n } from '@/lib/stores/i18n-store';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuth, fetchProfile } from '@/lib/stores/auth-store';
import { getRoleHome } from '@/lib/dashboard-roles';

const schema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  remember: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

// Demo e-mail hints are shown ONLY when NEXT_PUBLIC_DEMO_MODE === 'true'. No password is ever embedded
// in the client bundle: demo credentials are shared out-of-band (see SETUP.md).
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const demoAccounts = [
  { email: 'admin@smartcity-rdc.cd', label: 'Administrateur' },
  { email: 'government@smartcity-rdc.cd', label: 'Gouvernement' },
  { email: 'ministry@smartcity-rdc.cd', label: 'Ministère' },
  { email: 'province@smartcity-rdc.cd', label: 'Province' },
  { email: 'commune@smartcity-rdc.cd', label: 'Commune' },
  { email: 'agent@smartcity-rdc.cd', label: 'Agent terrain' },
  { email: 'citizen@smartcity-rdc.cd', label: 'Citoyen' },
];

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { setUser } = useAuth();
  const [showPwd, setShowPwd] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { remember: true } });

  const onSubmit = async (data: FormData) => {
    if (!isSupabaseConfigured) {
      toast.error('Backend non configuré', { description: 'Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.' });
      return;
    }
    try {
      // Check for brute-force lockout (non-blocking on failure)
      try {
        const { data: lockCheck } = await supabase.rpc('check_login_attempts', {
          p_identifier: data.email,
          p_max_attempts: 5,
          p_window_minutes: 15,
        });

        if (lockCheck && lockCheck[0]?.locked) {
          toast.error('Compte temporairement verrouillé', {
            description: 'Trop de tentatives échouées. Réessayez dans 15 minutes.',
          });
          return;
        }
      } catch {
        // If lock check fails, proceed with login attempt
      }

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      // Log the attempt (fire-and-forget, never blocks login)
      supabase.rpc('record_login_attempt', {
        p_identifier: data.email,
        p_success: !error,
        p_agent: navigator.userAgent,
      }).then(() => {}, () => {});

      if (error) throw error;

      if (authData.user) {
        // Log security event (fire-and-forget)
        supabase.rpc('log_security_event', {
          p_event_type: 'successful_login',
          p_user_id: authData.user.id,
          p_ip: '',
          p_agent: navigator.userAgent,
          p_details: {},
          p_severity: 'info',
        }).then(() => {}, () => {});

        const profile = await fetchProfile(authData.user.id);
        if (profile) {
          setUser({ ...profile, email: authData.user.email || '' });
          toast.success('Connexion réussie', { description: `Bienvenue, ${profile.name}` });
          router.push(getRoleHome(profile.role));
        } else {
          toast.error('Profil introuvable', { description: 'Contactez un administrateur.' });
        }
      }
    } catch (err: any) {
      toast.error('Connexion échouée', {
        description: err?.message || 'Une erreur est survenue. Veuillez réessayer.',
      });
    }
  };

  const quickLogin = (email: string) => {
    setValue('email', email);
  };

  return (
    <AuthShell title={t('auth.login.title')} subtitle={t('auth.login.subtitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" className="pl-9" placeholder="vous@smartcity-rdc.cd" {...register('email')} aria-invalid={!!errors.email} />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              {t('auth.forgotLink')}
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPwd ? 'text' : 'password'}
              className="pl-9 pr-9"
              placeholder="••••••••"
              {...register('password')}
              aria-invalid={!!errors.password}
            />
            <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="remember" defaultChecked />
          <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
            Se souvenir de moi
          </Label>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              {t('common.loading')}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <LogIn className="h-4 w-4" />
              {t('auth.login.button')}
            </span>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {t('auth.noAccount')}{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t('nav.register')}
          </Link>
        </p>
      </form>

      {DEMO_MODE && (
        <div className="mt-8 rounded-lg border border-dashed border-warning/50 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-warning">Environnement de démonstration</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Pré-remplit l&apos;e-mail du compte de démonstration. Le mot de passe vous est communiqué séparément.
          </p>
          <div className="flex flex-wrap gap-2">
            {demoAccounts.map((a) => (
              <button
                type="button"
                key={a.email}
                onClick={() => quickLogin(a.email)}
                className="rounded-md border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:bg-muted"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}
