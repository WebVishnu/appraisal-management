import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AdminDashboard() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'super_admin') {
    redirect('/dashboard');
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage users and view system reports</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Create and manage HR users and Managers</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/dashboard/admin/users" className="text-blue-600 hover:underline">
              Go to User Management →
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
            <CardDescription>View all appraisal reports and analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/dashboard/admin/reports" className="text-blue-600 hover:underline">
              View Reports →
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

