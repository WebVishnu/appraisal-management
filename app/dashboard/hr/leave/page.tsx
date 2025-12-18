import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import HRLeaveClient from '@/components/hr/leave-client';

export default async function HRLeavePage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return <HRLeaveClient />;
}

