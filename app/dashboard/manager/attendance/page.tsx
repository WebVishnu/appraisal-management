import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ManagerAttendanceClient from '@/components/manager/attendance-client';

export default async function ManagerAttendancePage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'manager' && user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return <ManagerAttendanceClient />;
}

