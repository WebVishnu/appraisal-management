import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';
import EmployeeDetailsClient from '@/components/shared/employee-details-client';

export default async function EmployeeProfilePage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'employee') {
    redirect('/dashboard');
  }

  // Get employee ID from session
  await connectDB();
  const employee = await Employee.findOne({ email: user.email });
  
  if (!employee) {
    redirect('/dashboard');
  }

  // Pass employee ID as a prop or use a different approach
  // Since the component uses useParams, we'll redirect to a route with the ID
  redirect(`/dashboard/employee/profile/${employee._id}`);
}

