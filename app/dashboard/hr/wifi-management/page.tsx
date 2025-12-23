import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WiFiManagementClient from '@/components/hr/wifi-management-client';

export default async function WiFiManagementPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'hr' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  return <WiFiManagementClient />;
}

