'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/stores/auth-store';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  category: string;
}

interface NotificationState {
  notifications: Notification[];
  loaded: boolean;
  load: (userId: string) => Promise<void>;
  subscribe: (userId: string) => () => void;
  add: (n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  setLocal: (items: Notification[]) => void;
}

export const useNotifications = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      loaded: false,
      setLocal: (items) => set({ notifications: items, loaded: true }),

      load: async (userId: string) => {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) return;

        const mapped: Notification[] = (data || []).map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          read: n.read,
          createdAt: n.created_at,
          category: n.category || '',
        }));

        set({ notifications: mapped, loaded: true });
      },

      subscribe: (userId: string) => {
        const channel = supabase
          .channel(`notifications:${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              const n = payload.new as any;
              const mapped: Notification = {
                id: n.id,
                title: n.title,
                message: n.message,
                type: n.type,
                read: n.read,
                createdAt: n.created_at,
                category: n.category || '',
              };
              set((s) => ({ notifications: [mapped, ...s.notifications] }));
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      },

      add: (n) =>
        set((s) => ({
          notifications: [
            {
              ...n,
              id: Math.random().toString(36).slice(2),
              read: false,
              createdAt: new Date().toISOString(),
            },
            ...s.notifications,
          ],
        })),

      markAsRead: async (id: string) => {
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
        await supabase.from('notifications').update({ read: true }).eq('id', id);
      },

      markAllAsRead: async () => {
        const { user } = useAuth.getState();
        if (!user) return;
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        }));
        await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
      },

      remove: async (id: string) => {
        set((s) => ({
          notifications: s.notifications.filter((n) => n.id !== id),
        }));
        await supabase.from('notifications').delete().eq('id', id);
      },

      clearAll: async () => {
        const { user } = useAuth.getState();
        if (user) {
          await supabase.from('notifications').delete().eq('user_id', user.id);
        }
        set({ notifications: [] });
      },
    }),
    {
      name: 'rdc-notifications',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : (undefined as unknown as Storage))),
    }
  )
);
