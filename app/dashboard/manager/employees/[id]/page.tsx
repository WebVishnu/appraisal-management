import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EmployeeDetailsClient from '@/components/shared/employee-details-client';

export default async function ManagerEmployeeDetailsPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'manager') {
    redirect('/dashboard');
  }

  return <EmployeeDetailsClient />;
}

