'use client';

// This is a wrapper that imports and uses the existing onboarding dashboard
// We'll extract the onboarding-specific content from onboarding-dashboard-client.tsx
import OnboardingDashboardClient from '../onboarding-dashboard-client';

export default function OnboardingTab() {
  return <OnboardingDashboardClient />;
}

