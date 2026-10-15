'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

const schema = z
  .object({
    password: z.string().min(8, 'Au moins 8 caractères'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Les mots de passe ne correspondent pas' });
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!isSupabaseConfigured) { setChecked(true); return; }
    // Le lien de récupération pose une session temporaire (detectSessionInUrl) ; on attend l'événement ou la session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { setReady(true); setChecked(true); }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecked(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (data: FormData) => {
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) { toast.error('Erreur', { description: error.message }); return; }
    setDone(true);
    toast.success('Mot de passe mis à jour');
    await supabase.auth.signOut();
    setTimeout(() => router.push('/login'), 1500);
  };

  return (
    <AuthShell title="Nouveau mot de passe" subtitle="Choisissez un nouveau mot de passe pour votre compte">
      {!isSupabaseConfigured ? (
        <p role="alert" className="text-sm text-destructive">Backend non configuré : réinitialisation indisponible.</p>
      ) : done ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
          <p className="text-sm text-muted-foreground">Mot de passe modifié. Redirection vers la connexion…</p>
        </div>
      ) : checked && !ready ? (
        <div className="space-y-4">
          <p role="alert" className="text-sm text-destructive">Lien invalide ou expiré. Demandez un nouveau lien de réinitialisation.</p>
          <Button asChild className="w-full"><Link href="/forgot-password">Demander un nouveau lien</Link></Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="password" type="password" autoComplete="new-password" className="pl-9" {...register('password')} />
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmer le mot de passe</Label>
            <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement…' : 'Mettre à jour'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
