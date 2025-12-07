import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ReportsClient from '@/components/reports/reports-client';

export default async function AdminReportsPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'super_admin') {
    redirect('/dashboard');
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Appraisal Reports</h1>
        <p className="text-gray-600 mt-2">View and filter appraisal reports</p>
      </div>
      <ReportsClient />
    </div>
  );
}

