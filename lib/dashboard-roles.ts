import { UserRole } from '@/lib/stores/auth-store';

export const DASHBOARD_ROLES: Record<string, UserRole[]> = {
  SHARED: ['admin', 'government', 'ministry', 'province', 'commune', 'police', 'emergency', 'water', 'energy', 'waste', 'transport', 'agent', 'citizen'],
  admin: ['admin'],
  presidential: ['admin', 'government'],
  national: ['admin', 'government', 'ministry'],
  government: ['admin', 'government', 'ministry'],
  ministry: ['admin', 'ministry'],
  province: ['admin', 'government', 'ministry', 'province'],
  commune: ['admin', 'province', 'commune'],
  police: ['admin', 'police'],
  emergency: ['admin', 'emergency', 'police'],
  water: ['admin', 'water'],
  energy: ['admin', 'energy'],
  waste: ['admin', 'waste'],
  transport: ['admin', 'transport'],
  citizen: ['citizen', 'agent'],
  agent: ['admin', 'agent', 'commune', 'province'],
};

export function canAccessDashboard(dashboard: string, role: UserRole | null | undefined): boolean {
  if (!role) return false;
  const allowed = DASHBOARD_ROLES[dashboard];
  if (!allowed) return false;
  return allowed.includes(role);
}

export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/dashboard/admin',
  government: '/dashboard/government',
  ministry: '/dashboard/ministry',
  province: '/dashboard/province',
  commune: '/dashboard/commune',
  police: '/dashboard/police',
  emergency: '/dashboard/emergency',
  water: '/dashboard/water',
  energy: '/dashboard/energy',
  waste: '/dashboard/waste',
  transport: '/dashboard/transport',
  agent: '/dashboard/agent',
  citizen: '/dashboard/citizen',
};

export function getRoleHome(role: UserRole): string {
  return ROLE_HOME[role] || '/dashboard';
}
