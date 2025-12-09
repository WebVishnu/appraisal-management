import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon } from 'lucide-react';

export default async function ManagerCalendarPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'manager' && user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">Team Calendar</h1>
        <p className="text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-2">
          View team schedules, deadlines, and important dates
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendar View
          </CardTitle>
          <CardDescription>Team calendar feature coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
            <div className="text-center">
              <CalendarIcon className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-[hsl(var(--muted-foreground))]" />
              <p className="text-lg font-medium mb-2 dark:text-[hsl(var(--foreground))]">Calendar View</p>
              <p className="text-sm dark:text-[hsl(var(--muted-foreground))]">Calendar integration will be available soon</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

