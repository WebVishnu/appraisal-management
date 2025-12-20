import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EmployeeManagementClient from '@/components/hr/employee-management-client';

export default async function EmployeesPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return (
    <div className="px-3 sm:px-4 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">Employee Management</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-1 sm:mt-2">Create and manage employees, assign managers</p>
      </div>
      <EmployeeManagementClient />
    </div>
  );
}

