import OnboardingFormClient from '@/components/employee/onboarding-form-client';
import connectDB from '@/lib/mongodb';
import OnboardingRequest from '@/lib/models/OnboardingRequest';
import { isTokenExpired } from '@/lib/utils/onboarding';
import { notFound } from 'next/navigation';

export default async function OnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    if (!token) {
      notFound();
    }

    // Basic server-side validation of token
    await connectDB();
    
    const request = await OnboardingRequest.findOne({ token });

    if (!request) {
      notFound();
    }

    // Check if token is expired
    if (isTokenExpired(request.tokenExpiry)) {
      // Still render the component, it will show the error from the API
      // The API will handle the proper error message
    }

    // Token is valid, render the form
    // Note: Authentication checks are handled by the API route
    // This page allows both authenticated (HR/Manager) and unauthenticated (employee) access
    return <OnboardingFormClient />;
  } catch (error) {
    console.error('Error validating onboarding token:', error);
    notFound();
  }
}
