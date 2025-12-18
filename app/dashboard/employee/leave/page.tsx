import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EmployeeLeaveClient from '@/components/employee/leave-client';

export default async function EmployeeLeavePage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'employee') {
    redirect('/dashboard');
  }

  return <EmployeeLeaveClient />;
}

