import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function HRDashboard() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">HR Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage employees, appraisal cycles, and view reports</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Employee Management</CardTitle>
            <CardDescription>Create and manage employees, assign managers</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/dashboard/hr/employees" className="text-blue-600 hover:underline">
              Go to Employees →
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appraisal Cycles</CardTitle>
            <CardDescription>Create and manage appraisal cycles</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/dashboard/hr/cycles" className="text-blue-600 hover:underline">
              Go to Cycles →
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
            <CardDescription>View appraisal reports and analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/dashboard/hr/reports" className="text-blue-600 hover:underline">
              View Reports →
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

