import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EmployeeShiftClient from '@/components/employee/shift-client';

export default async function EmployeeShiftsPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'employee') {
    redirect('/dashboard');
  }

  return (
    <div className="px-4 py-6">
      <EmployeeShiftClient />
    </div>
  );
}

