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

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Get all employees
    const totalEmployees = await Employee.countDocuments({ isActive: true });
    const totalEmployeesAll = await Employee.countDocuments();

    // Get active cycles
    const activeCycles = await AppraisalCycle.countDocuments({
      status: { $in: ['open_self_review', 'open_manager_review'] },
    });
    const totalCycles = await AppraisalCycle.countDocuments();

    // Get all cycles with status breakdown
    const cyclesByStatus = await AppraisalCycle.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const cyclesStatusMap = cyclesByStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    // Get pending reviews
    const openSelfReviewCycles = await AppraisalCycle.find({
      status: 'open_self_review',
    }).select('_id');

    const openManagerReviewCycles = await AppraisalCycle.find({
      status: 'open_manager_review',
    }).select('_id');

    const cycleIdsSelf = openSelfReviewCycles.map((c) => c._id);
    const cycleIdsManager = openManagerReviewCycles.map((c) => c._id);

    const pendingSelfReviews = await SelfReview.countDocuments({
      cycleId: { $in: cycleIdsSelf },
      status: 'draft',
    });

    const pendingManagerReviews = await ManagerReview.countDocuments({
      cycleId: { $in: cycleIdsManager },
      status: 'draft',
    });

    // Get completion rates
    const totalSelfReviews = await SelfReview.countDocuments({
      cycleId: { $in: cycleIdsSelf },
    });
    const completedSelfReviews = await SelfReview.countDocuments({
      cycleId: { $in: cycleIdsSelf },
      status: 'submitted',
    });

    const totalManagerReviews = await ManagerReview.countDocuments({
      cycleId: { $in: cycleIdsManager },
    });
    const completedManagerReviews = await ManagerReview.countDocuments({
      cycleId: { $in: cycleIdsManager },
      status: 'submitted',
    });

    const selfReviewCompletionRate =
      totalSelfReviews > 0 ? (completedSelfReviews / totalSelfReviews) * 100 : 0;
    const managerReviewCompletionRate =
      totalManagerReviews > 0 ? (completedManagerReviews / totalManagerReviews) * 100 : 0;

    // Get average ratings from closed cycles
    const closedCycles = await AppraisalCycle.find({ status: 'closed' }).select('_id');
    const closedCycleIds = closedCycles.map((c) => c._id);

    const completedManagerReviewsWithRatings = await ManagerReview.find({
      cycleId: { $in: closedCycleIds },
      status: 'submitted',
    }).select('finalRating');

    const ratings = completedManagerReviewsWithRatings
      .map((r) => {
        const match = r.finalRating.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : null;
      })
      .filter((r): r is number => r !== null);

    const averageRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSelfReviews = await SelfReview.countDocuments({
      submittedAt: { $gte: sevenDaysAgo },
      status: 'submitted',
    });

    const recentManagerReviews = await ManagerReview.countDocuments({
      submittedAt: { $gte: sevenDaysAgo },
      status: 'submitted',
    });

    // Get rating distribution
    const ratingDistribution = {
      '1': ratings.filter((r) => r >= 1 && r < 2).length,
      '2': ratings.filter((r) => r >= 2 && r < 3).length,
      '3': ratings.filter((r) => r >= 3 && r < 4).length,
      '4': ratings.filter((r) => r >= 4 && r < 5).length,
      '5': ratings.filter((r) => r >= 5).length,
    };

    return NextResponse.json({
      overview: {
        totalEmployees,
        totalEmployeesAll,
        activeCycles,
        totalCycles,
        pendingSelfReviews,
        pendingManagerReviews,
        averageRating: Math.round(averageRating * 10) / 10,
      },
      completionRates: {
        selfReview: Math.round(selfReviewCompletionRate * 10) / 10,
        managerReview: Math.round(managerReviewCompletionRate * 10) / 10,
      },
      cyclesByStatus: {
        draft: cyclesStatusMap.draft || 0,
        open_self_review: cyclesStatusMap.open_self_review || 0,
        open_manager_review: cyclesStatusMap.open_manager_review || 0,
        closed: cyclesStatusMap.closed || 0,
      },
      recentActivity: {
        selfReviewsSubmitted: recentSelfReviews,
        managerReviewsSubmitted: recentManagerReviews,
        totalSubmissions: recentSelfReviews + recentManagerReviews,
      },
      ratingDistribution,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

