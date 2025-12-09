import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardRedirect() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Redirect based on role
  switch (user.role) {
    case 'super_admin':
      redirect('/dashboard/admin');
      
    case 'hr':
      redirect('/dashboard/hr');
    case 'manager':
      redirect('/dashboard/manager');
    case 'employee':
      redirect('/dashboard/employee');
    default:
      redirect('/login');
  }
}

