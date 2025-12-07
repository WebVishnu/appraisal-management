import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function EmployeeDashboard() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'employee') {
    redirect('/dashboard');
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Employee Dashboard</h1>
        <p className="text-gray-600 mt-2">View your appraisals and submit self-assessments</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My Appraisals</CardTitle>
            <CardDescription>View and manage your appraisals</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/dashboard/employee/appraisals" className="text-blue-600 hover:underline">
              Go to Appraisals →
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

