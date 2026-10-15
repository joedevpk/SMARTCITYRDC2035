import { create } from 'zustand';

/** État du tiroir de navigation mobile du tableau de bord (partagé entre la barre du haut et le menu latéral). */
type NavState = { mobileOpen: boolean; setMobileOpen: (open: boolean) => void };

export const useDashboardNav = create<NavState>((set) => ({
  mobileOpen: false,
  setMobileOpen: (mobileOpen) => set({ mobileOpen }),
}));
