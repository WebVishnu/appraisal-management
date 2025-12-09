import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EmployeeProfileClient from '@/components/hr/employee-profile-client';

export default async function EmployeeProfilePage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return <EmployeeProfileClient />;
}

