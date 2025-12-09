import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyGoals } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default async function EmployeeGoalsPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'employee') {
    redirect('/dashboard');
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">My Goals</h1>
          <p className="text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-2">
            View and track your personal development goals
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Goal
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Goals</CardTitle>
          <CardDescription>Goal tracking feature coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyGoals />
        </CardContent>
      </Card>
    </div>
  );
}

