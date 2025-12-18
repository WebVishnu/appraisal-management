import { auth } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import ManagerWorkReportClient from '@/components/manager/work-report-client';

export default async function ManagerWorkReportsPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  if (session.user.role !== 'manager' && session.user.role !== 'hr' && session.user.role !== 'super_admin') {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <ManagerWorkReportClient />
    </div>
  );
}

