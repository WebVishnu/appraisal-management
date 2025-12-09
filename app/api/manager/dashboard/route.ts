import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';
import AppraisalCycle from '@/lib/models/AppraisalCycle';
import ManagerReview from '@/lib/models/ManagerReview';
import SelfReview from '@/lib/models/SelfReview';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || session.user.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

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

    const teamSize = teamMembers.length;

    // Get active cycles
    const activeCycles = await AppraisalCycle.find({
      status: { $in: ['open_self_review', 'open_manager_review'] },
    });

    // Get pending reviews for manager
    const openManagerReviewCycles = await AppraisalCycle.find({
      status: 'open_manager_review',
    }).select('_id');

    const cycleIds = openManagerReviewCycles.map((c) => c._id);
    const teamMemberIds = teamMembers.map((m) => m._id);

    const pendingReviews = await ManagerReview.countDocuments({
      cycleId: { $in: cycleIds },
      employeeId: { $in: teamMemberIds },
      status: 'draft',
    });

    const completedReviews = await ManagerReview.countDocuments({
      cycleId: { $in: cycleIds },
      employeeId: { $in: teamMemberIds },
      status: 'submitted',
    });

    const totalReviews = pendingReviews + completedReviews;
    const completionRate = totalReviews > 0 ? (completedReviews / totalReviews) * 100 : 0;

    // Get team average rating from closed cycles
    const closedCycles = await AppraisalCycle.find({ status: 'closed' }).select('_id');
    const closedCycleIds = closedCycles.map((c) => c._id);

    const teamReviews = await ManagerReview.find({
      cycleId: { $in: closedCycleIds },
      employeeId: { $in: teamMemberIds },
      status: 'submitted',
    }).select('finalRating');

    const ratings = teamReviews
      .map((r) => {
        const match = r.finalRating.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : null;
      })
      .filter((r): r is number => r !== null);

    const averageRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    // Get team member completion status
    const memberCompletionStatus = await Promise.all(
      teamMembers.map(async (member) => {
        const memberReviews = await ManagerReview.countDocuments({
          cycleId: { $in: cycleIds },
          employeeId: member._id,
          status: 'submitted',
        });
        const memberPending = await ManagerReview.countDocuments({
          cycleId: { $in: cycleIds },
          employeeId: member._id,
          status: 'draft',
        });
        return {
          employeeId: member._id,
          name: member.name,
          completed: memberReviews,
          pending: memberPending,
          completionRate: memberReviews + memberPending > 0
            ? (memberReviews / (memberReviews + memberPending)) * 100
            : 0,
        };
      })
    );

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSubmissions = await ManagerReview.countDocuments({
      employeeId: { $in: teamMemberIds },
      submittedAt: { $gte: sevenDaysAgo },
      status: 'submitted',
    });

    // Calculate team health score (0-100)
    // Based on: completion rate (40%), average rating (40%), recent activity (20%)
    const healthScore = Math.round(
      (completionRate * 0.4) +
      ((averageRating / 5) * 100 * 0.4) +
      (Math.min(recentSubmissions / teamSize, 1) * 100 * 0.2)
    );

    // Get rating distribution
    const ratingDistribution = {
      '1-2': ratings.filter((r) => r >= 1 && r < 3).length,
      '3': ratings.filter((r) => r >= 3 && r < 4).length,
      '4': ratings.filter((r) => r >= 4 && r < 5).length,
      '5': ratings.filter((r) => r >= 5).length,
    };

    return NextResponse.json({
      overview: {
        teamSize,
        activeCycles: activeCycles.length,
        pendingReviews,
        completedReviews,
        completionRate: Math.round(completionRate * 10) / 10,
        averageRating: Math.round(averageRating * 10) / 10,
        healthScore,
      },
      memberCompletionStatus,
      recentActivity: {
        submissions: recentSubmissions,
      },
      ratingDistribution,
    });
  } catch (error) {
    console.error('Error fetching manager dashboard stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

