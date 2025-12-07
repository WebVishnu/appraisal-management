import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EmployeeAppraisalsClient from '@/components/employee/appraisals-client';

export default async function EmployeeAppraisalsPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'employee') {
    redirect('/dashboard');
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">My Appraisals</h1>
        <p className="text-gray-600 mt-2">View and submit your self-assessments</p>
      </div>
      <EmployeeAppraisalsClient />
    </div>
  );
}

