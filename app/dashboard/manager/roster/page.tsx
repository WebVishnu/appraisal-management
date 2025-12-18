import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ManagerRosterClient from '@/components/manager/roster-client';

export default async function ManagerRosterPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'manager') {
    redirect('/dashboard');
  }

  return (
    <div className="px-4 py-6">
      <ManagerRosterClient />
    </div>
  );
}

