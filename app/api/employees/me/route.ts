import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';
import ManagerReview from '@/lib/models/ManagerReview';
import SelfReview from '@/lib/models/SelfReview';
import AppraisalCycle from '@/lib/models/AppraisalCycle';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Get employee record
    const employee = await Employee.findOne({ email: session.user.email });
    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    }

    // Get all appraisal history
    const managerReviews = await ManagerReview.find({ employeeId: employee._id })
      .populate('cycleId', 'name startDate endDate status')
      .populate('managerId', 'name employeeId')
      .sort({ createdAt: -1 });

    const selfReviews = await SelfReview.find({ employeeId: employee._id })
      .populate('cycleId', 'name startDate endDate status')
      .sort({ createdAt: -1 });

    // Combine reviews and sort by date
    const allReviews = [
      ...managerReviews.map((r) => ({
        type: 'manager' as const,
        cycleId: r.cycleId,
        rating: r.finalRating,
        submittedAt: r.submittedAt,
        createdAt: r.createdAt,
        status: r.status,
      })),
      ...selfReviews.map((r) => ({
        type: 'self' as const,
        cycleId: r.cycleId,
        rating: null,
        submittedAt: r.submittedAt,
        createdAt: r.createdAt,
        status: r.status,
      })),
    ].sort((a, b) => {
      const dateA = a.cycleId && typeof a.cycleId === 'object' && 'startDate' in a.cycleId
        ? new Date(a.cycleId.startDate as Date).getTime()
        : 0;
      const dateB = b.cycleId && typeof b.cycleId === 'object' && 'startDate' in b.cycleId
        ? new Date(b.cycleId.startDate as Date).getTime()
        : 0;
      return dateB - dateA;
    });

    return NextResponse.json({
      employee,
      reviews: allReviews,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

