import OnboardingFormClient from '@/components/employee/onboarding-form-client';

export default async function OnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  return <OnboardingFormClient />;
}
