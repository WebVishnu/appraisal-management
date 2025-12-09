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

    if (!session || session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Get employee record
    const employee = await Employee.findOne({ email: session.user.email });
    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    }

    // Get active cycles
    const activeCycles = await AppraisalCycle.find({
      status: { $in: ['open_self_review', 'open_manager_review'] },
    });

    // Get upcoming deadlines (cycles ending in next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const upcomingDeadlines = await AppraisalCycle.find({
      endDate: { $lte: sevenDaysFromNow, $gte: new Date() },
      status: { $in: ['open_self_review', 'open_manager_review'] },
    }).sort({ endDate: 1 });

    // Get self reviews
    const selfReviews = await SelfReview.find({ employeeId: employee._id });
    const reviewsCompleted = selfReviews.filter((r) => r.status === 'submitted').length;

    // Get manager reviews (final ratings)
    const managerReviews = await ManagerReview.find({
      employeeId: employee._id,
      status: 'submitted',
    }).populate('cycleId', 'name startDate endDate');

    // Calculate average rating
    const ratings = managerReviews
      .map((r) => {
        const match = r.finalRating.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : null;
      })
      .filter((r): r is number => r !== null);

    const averageRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSubmissions = await SelfReview.countDocuments({
      employeeId: employee._id,
      submittedAt: { $gte: sevenDaysAgo },
      status: 'submitted',
    });

    // Get pending reviews
    const openSelfReviewCycles = await AppraisalCycle.find({
      status: 'open_self_review',
    }).select('_id');
    const cycleIds = openSelfReviewCycles.map((c) => c._id);

    const pendingSelfReviews = await SelfReview.countDocuments({
      cycleId: { $in: cycleIds },
      employeeId: employee._id,
      status: 'draft',
    });

    // Get latest manager review
    const latestReview = await ManagerReview.findOne({
      employeeId: employee._id,
      status: 'submitted',
    })
      .populate('cycleId', 'name')
      .sort({ submittedAt: -1 });

    // Get rating trend (last 5 reviews)
    const recentReviews = await ManagerReview.find({
      employeeId: employee._id,
      status: 'submitted',
    })
      .populate('cycleId', 'name startDate')
      .sort({ submittedAt: -1 })
      .limit(5);

    const ratingTrend = recentReviews
      .map((r) => {
        const match = r.finalRating.match(/(\d+\.?\d*)/);
        return {
          cycle: r.cycleId && typeof r.cycleId === 'object' && 'name' in r.cycleId
            ? r.cycleId.name
            : 'Unknown',
          rating: match ? parseFloat(match[1]) : null,
          date: r.submittedAt || new Date(),
        };
      })
      .filter((r): r is { cycle: string; rating: number; date: Date } => r.rating !== null)
      .reverse();

    return NextResponse.json({
      overview: {
        reviewsCompleted,
        pendingSelfReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        currentRating: latestReview?.finalRating || 'N/A',
        activeCycles: activeCycles.length,
      },
      upcomingDeadlines: upcomingDeadlines.map((cycle) => ({
        id: cycle._id.toString(),
        name: cycle.name,
        endDate: cycle.endDate,
        status: cycle.status,
        daysRemaining: Math.ceil(
          (cycle.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      recentActivity: {
        submissions: recentSubmissions,
      },
      ratingTrend,
      latestReview: latestReview
        ? {
            cycleName: latestReview.cycleId && typeof latestReview.cycleId === 'object' && 'name' in latestReview.cycleId
              ? latestReview.cycleId.name
              : 'Unknown',
            rating: latestReview.finalRating,
            submittedAt: latestReview.submittedAt,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching employee dashboard stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

