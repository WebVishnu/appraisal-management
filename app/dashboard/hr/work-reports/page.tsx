import { auth } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import WorkReportAnalyticsClient from '@/components/hr/work-report-analytics-client';

export default async function HRWorkReportsPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  if (session.user.role !== 'hr' && session.user.role !== 'super_admin') {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <WorkReportAnalyticsClient />
    </div>
  );
}

