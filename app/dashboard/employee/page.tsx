import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EmployeeDashboardClient from '@/components/employee/employee-dashboard-client';

export default async function EmployeeDashboard() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'employee') {
    redirect('/dashboard');
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">Employee Dashboard</h1>
        <p className="text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-2">
          View your appraisals and submit self-assessments
        </p>
      </div>
      <EmployeeDashboardClient />
    </div>
  );
}

