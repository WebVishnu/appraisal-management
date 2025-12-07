import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ManagerDashboard() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'manager' && user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Manager Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage team reviews and view appraisal history</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Team Reviews</CardTitle>
            <CardDescription>Review and evaluate your team members</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/dashboard/manager/reviews" className="text-blue-600 hover:underline">
              Go to Team Reviews →
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

