import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import OnboardingDashboardClient from '@/components/hr/onboarding-dashboard-client';

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return <OnboardingDashboardClient />;
}
