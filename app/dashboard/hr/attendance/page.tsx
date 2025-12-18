import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import HRAttendanceClient from '@/components/hr/attendance-client';

export default async function HRAttendancePage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return <HRAttendanceClient />;
}

