import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import HRDashboardClient from '@/components/hr/hr-dashboard-client';

export default async function HRDashboard() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">HR Dashboard</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-1 sm:mt-2">Manage employees, appraisal cycles, and view reports</p>
      </div>
      <HRDashboardClient />
    </div>
  );
}

