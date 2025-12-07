import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import CycleManagementClient from '@/components/hr/cycle-management-client';

export default async function CyclesPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Appraisal Cycle Management</h1>
        <p className="text-gray-600 mt-2">Create and manage appraisal cycles</p>
      </div>
      <CycleManagementClient />
    </div>
  );
}

