'use client';

import { LucideIcon, Users, Calendar, FileText, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 p-3 rounded-full bg-gray-100 dark:bg-gray-800">
          <Icon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="default">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Predefined empty states for common scenarios
export function EmptyEmployees() {
  const router = useRouter();
  return (
    <EmptyState
      icon={Users}
      title="No employees found"
      description="Get started by creating your first employee."
      action={{
        label: 'Add Employee',
        onClick: () => router.push('/dashboard/hr/employees'),
      }}
    />
  );
}

export function EmptyCycles() {
  const router = useRouter();
  return (
    <EmptyState
      icon={Calendar}
      title="No appraisal cycles"
      description="Create an appraisal cycle to start the review process."
      action={{
        label: 'Create Cycle',
        onClick: () => router.push('/dashboard/hr/cycles'),
      }}
    />
  );
}

export function EmptyReviews() {
  return (
    <EmptyState
      icon={FileText}
      title="No reviews yet"
      description="Reviews will appear here once they are submitted."
    />
  );
}

export function EmptyGoals() {
  return (
    <EmptyState
      icon={Target}
      title="No goals set"
      description="Set goals to track progress and achievements."
    />
  );
}

