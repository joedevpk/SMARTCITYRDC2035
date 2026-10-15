'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@/lib/supabase/client';

export type UserRole =
  | 'admin'
  | 'government'
  | 'ministry'
  | 'province'
  | 'commune'
  | 'police'
  | 'emergency'
  | 'water'
  | 'energy'
  | 'waste'
  | 'transport'
  | 'agent'
  | 'citizen';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  province?: string;
  commune?: string;
  phone?: string;
}

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  setUser: (user: AppUser | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      setUser: (user) => set({ user, loading: false }),
      setLoading: (loading) => set({ loading }),
      signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null });
      },
    }),
    {
      name: 'rdc-auth',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : (undefined as unknown as Storage))),
      // SECURITY: never persist the user/role client-side (it could be edited in DevTools to flash
      // privileged screens). The role is always re-read from the database by useAuthInit.
      partialize: () => ({}),
    }
  )
);

export const roleLabels: Record<UserRole, { fr: string; en: string }> = {
  admin: { fr: 'Administrateur', en: 'Administrator' },
  government: { fr: 'Gouvernement', en: 'Government' },
  ministry: { fr: 'Ministère', en: 'Ministry' },
  province: { fr: 'Province', en: 'Province' },
  commune: { fr: 'Commune', en: 'Commune' },
  police: { fr: 'Police', en: 'Police' },
  emergency: { fr: 'Urgences', en: 'Emergency' },
  water: { fr: 'Service des Eaux', en: 'Water Service' },
  energy: { fr: 'Service de l\'Énergie', en: 'Energy Service' },
  waste: { fr: 'Service des Déchets', en: 'Waste Service' },
  transport: { fr: 'Service des Transports', en: 'Transport Service' },
  agent: { fr: 'Agent terrain', en: 'Field agent' },
  citizen: { fr: 'Citoyen', en: 'Citizen' },
};

// Helper to fetch profile from Supabase after auth
export async function fetchProfile(userId: string): Promise<AppUser | null> {
  const [profileRes, sessionRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        role,
        phone,
        avatar_url,
        is_active,
        province:provinces(name),
        commune:communes(name)
      `)
      .eq('id', userId)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const data = profileRes.data;
  const error = profileRes.error;

  if (error || !data || (data as any).is_active === false) return null;

  const email = sessionRes.data?.user?.email || '';

  return {
    id: data.id,
    name: data.full_name,
    email,
    role: data.role as UserRole,
    avatar: data.avatar_url || undefined,
    phone: data.phone || undefined,
    province: (data.province as any)?.name,
    commune: (data.commune as any)?.name,
  };
}
