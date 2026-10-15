'use client';

import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuth, fetchProfile } from '@/lib/stores/auth-store';

export function useAuthInit() {
  const { setUser, setLoading, user } = useAuth();

  useEffect(() => {
    let mounted = true;

    // Backend absent : on sort de l'état « chargement » sans toucher au client (il refuserait l'appel).
    if (!isSupabaseConfigured) {
      setUser(null);
      return () => { mounted = false; };
    }

    // Get initial session
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (profile && mounted) {
          setUser({ ...profile, email: session.user.email || '' });
          return;
        }
      }
      if (mounted) {
        setUser(null);
      }
    })();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          setUser(null);
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const profile = await fetchProfile(session.user.id);
          if (profile) {
            setUser({ ...profile, email: session.user.email || '' });
          }
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user };
}
