import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EmployeeDetailsClient from '@/components/shared/employee-details-client';

export default async function EmployeeProfilePage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'employee') {
    redirect('/dashboard');
  }

  return <EmployeeDetailsClient />;
}

