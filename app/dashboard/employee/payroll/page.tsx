import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EmployeePayrollClient from '@/components/employee/payroll-client';

export default async function EmployeePayrollPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'employee') {
    redirect('/dashboard');
  }

  return <EmployeePayrollClient />;
}

