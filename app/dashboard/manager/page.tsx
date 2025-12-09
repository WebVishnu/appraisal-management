import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ManagerDashboardClient from '@/components/manager/manager-dashboard-client';

export default async function ManagerDashboard() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'manager' && user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">Manager Dashboard</h1>
        <p className="text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-2">
          Manage team reviews and view appraisal history
        </p>
      </div>
      <ManagerDashboardClient />
    </div>
  );
}

