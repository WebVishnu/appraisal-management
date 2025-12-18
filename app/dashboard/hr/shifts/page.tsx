import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import HRShiftManagementClient from '@/components/hr/shift-management-client';

export default async function HRShiftsPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return (
    <div className="px-4 py-6">
      <HRShiftManagementClient />
    </div>
  );
}

