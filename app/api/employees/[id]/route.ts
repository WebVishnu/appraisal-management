import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';
import ManagerReview from '@/lib/models/ManagerReview';
import SelfReview from '@/lib/models/SelfReview';
import AppraisalCycle from '@/lib/models/AppraisalCycle';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    // Get employee with manager populated
    const employee = await Employee.findById(id).populate('managerId', 'name employeeId email');

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Get all appraisal history
    const managerReviews = await ManagerReview.find({ employeeId: id })
      .populate('cycleId', 'name startDate endDate status')
      .populate('managerId', 'name employeeId')
      .sort({ createdAt: -1 });

    const selfReviews = await SelfReview.find({ employeeId: id })
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

    // Calculate performance trends
    const ratings = managerReviews
      .filter((r) => r.finalRating && r.status === 'submitted')
      .map((r) => {
        const match = r.finalRating.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : null;
      })
      .filter((r): r is number => r !== null);

    const averageRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    // Get manager hierarchy
    const managerHierarchy = [];
    let currentManager = employee.managerId;
    while (currentManager && typeof currentManager === 'object' && '_id' in currentManager) {
      const manager = await Employee.findById(currentManager._id).populate('managerId', 'name employeeId');
      if (manager) {
        managerHierarchy.push({
          _id: manager._id,
          name: manager.name,
          employeeId: manager.employeeId,
          email: manager.email,
        });
        currentManager = manager.managerId;
      } else {
        break;
      }
    }

    return NextResponse.json({
      employee,
      reviews: allReviews,
      statistics: {
        totalReviews: managerReviews.length,
        averageRating: Math.round(averageRating * 10) / 10,
        ratings,
      },
      managerHierarchy,
    });
  } catch (error) {
    console.error('Error fetching employee profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

