import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ManagerLeaveClient from '@/components/manager/leave-client';

export default async function ManagerLeavePage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'manager' && user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return <ManagerLeaveClient />;
}

