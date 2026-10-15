'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, User, Phone, Eye, EyeOff, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/lib/stores/i18n-store';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuth, fetchProfile } from '@/lib/stores/auth-store';

const schema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Adresse email invalide'),
  phone: z.string().min(8, 'Numéro de téléphone invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { setUser } = useAuth();
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    if (!isSupabaseConfigured) {
      toast.error('Backend non configuré', { description: 'Inscription indisponible : la connexion au serveur n\'est pas configurée. Contactez l\'administrateur.' });
      return;
    }
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { full_name: data.name, phone: data.phone }, emailRedirectTo: `${window.location.origin}/login` },
      });

      if (error) throw error;

      if (authData.user) {
        // The database trigger auto-creates the profile with role=citizen,
        // full_name, and phone from the signup metadata.

        if (authData.session) {
          // Session is active (email confirmation disabled) — go straight to dashboard.
          const profile = await fetchProfile(authData.user.id);
          if (profile) {
            setUser({ ...profile, email: authData.user.email || '' });
          }
          toast.success('Compte créé avec succès', { description: 'Bienvenue sur SMART CITY RDC' });
          router.push('/dashboard/citizen');
        } else {
          // No session means email confirmation is required.
          toast.success('Compte créé', {
            description: 'Vérifiez votre boîte mail pour confirmer votre inscription, puis connectez-vous.',
          });
          router.push('/login');
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Une erreur est survenue.';
      if (msg.includes('already registered')) {
        toast.error('Inscription échouée', { description: 'Cette adresse email est déjà utilisée.' });
      } else if (msg.includes('weak_password') || msg.includes('Password')) {
        toast.error('Inscription échouée', { description: 'Le mot de passe est trop faible. Choisissez un mot de passe plus sécurisé.' });
      } else {
        toast.error('Inscription échouée', { description: msg });
      }
    }
  };

  return (
    <AuthShell title={t('auth.register.title')} subtitle={t('auth.register.subtitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="name">{t('auth.fullName')}</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="name" className="pl-9" placeholder="Votre nom complet" {...register('name')} aria-invalid={!!errors.name} />
          </div>
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" type="email" className="pl-9" placeholder="vous@exemple.cd" {...register('email')} aria-invalid={!!errors.email} />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t('auth.phone')}</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="phone" className="pl-9" placeholder="+243 ..." {...register('phone')} aria-invalid={!!errors.phone} />
            </div>
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="password" type={showPwd ? 'text' : 'password'} className="pl-9 pr-9" placeholder="••••••••" {...register('password')} aria-invalid={!!errors.password} />
              <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="confirmPassword" type={showConfirm ? 'text' : 'password'} className="pl-9 pr-9" placeholder="••••••••" {...register('confirmPassword')} aria-invalid={!!errors.confirmPassword} />
              <button type="button" onClick={() => setShowConfirm((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              {t('common.loading')}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              {t('auth.register.button')}
            </span>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {t('auth.haveAccount')}{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t('nav.login')}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
