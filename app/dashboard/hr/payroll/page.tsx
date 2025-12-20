import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PayrollManagementClient from '@/components/hr/payroll-management-client';

export default async function PayrollPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return <PayrollManagementClient />;
}

