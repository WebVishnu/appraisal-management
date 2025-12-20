import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import HiringPipelineClient from '@/components/hr/hiring-pipeline-client';

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return <HiringPipelineClient />;
}
