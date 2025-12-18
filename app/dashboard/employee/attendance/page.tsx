import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AttendanceClient from '@/components/employee/attendance-client';

export default async function EmployeeAttendancePage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'employee') {
    redirect('/dashboard');
  }

  return <AttendanceClient />;
}

