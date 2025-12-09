import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ManagerReviewsClient from '@/components/manager/reviews-client';

export default async function ManagerReviewsPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'manager' && user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return (
    <div>
      <ManagerReviewsClient />
    </div>
  );
}

