import { auth } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import WorkReportClient from '@/components/employee/work-report-client';

export default async function WorkReportsPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  if (session.user.role !== 'employee') {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <WorkReportClient />
    </div>
  );
}

