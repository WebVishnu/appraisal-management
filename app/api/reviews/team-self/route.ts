import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import SelfReview from '@/lib/models/SelfReview';
import Employee from '@/lib/models/Employee';

// GET - Get self reviews for manager's team members
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

    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycleId');

    if (!cycleId) {
      return NextResponse.json({ error: 'Cycle ID is required' }, { status: 400 });
    }

    // Get manager's employee record
    const managerEmployee = await Employee.findOne({ email: session.user.email });
    if (!managerEmployee) {
      return NextResponse.json({ error: 'Manager employee record not found' }, { status: 404 });
    }

    // Get team members
    const teamMembers = await Employee.find({
      managerId: managerEmployee._id,
      isActive: true,
    });

    const teamMemberIds = teamMembers.map((m) => m._id);

    // Fetch self reviews for all team members for the specified cycle
    const selfReviews = await SelfReview.find({
      cycleId: cycleId,
      employeeId: { $in: teamMemberIds },
    })
      .populate('employeeId', 'name email employeeId')
      .populate('cycleId', 'name status startDate endDate')
      .sort({ submittedAt: -1, createdAt: -1 });

    return NextResponse.json(selfReviews);
  } catch (error) {
    console.error('Error fetching team self reviews:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

