import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EmployeePerformanceHistoryClient from '@/components/employee/performance-history-client';

export default async function EmployeePerformanceHistoryPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'employee') {
    redirect('/dashboard');
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">Performance History</h1>
        <p className="text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-2">
          View your complete performance history and trends
        </p>
      </div>
      <EmployeePerformanceHistoryClient />
    </div>
  );
}

