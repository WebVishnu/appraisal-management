import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';

// GET - Get team members for current manager
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'manager' && session.user.role !== 'hr' && session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    const teamMembers = await Employee.find({
      managerId: session.user.employeeId,
      isActive: true,
    }).sort({ name: 1 });

    return NextResponse.json(teamMembers);
  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

