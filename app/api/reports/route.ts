import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import ManagerReview from '@/lib/models/ManagerReview';
import SelfReview from '@/lib/models/SelfReview';
import Employee from '@/lib/models/Employee';
import AppraisalCycle from '@/lib/models/AppraisalCycle';
import mongoose from 'mongoose';

// GET - Get reports with filters
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (
      !session ||
      (session.user.role !== 'hr' &&
        session.user.role !== 'super_admin')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycleId');
    const managerId = searchParams.get('managerId');
    const employeeId = searchParams.get('employeeId');

    // Fetch all manager reviews (both draft and submitted) for comprehensive reporting
    // HR/Admin should be able to see all reviews regardless of status
    const query: any = {};

    if (cycleId && cycleId !== 'all') {
      if (mongoose.Types.ObjectId.isValid(cycleId)) {
        query.cycleId = new mongoose.Types.ObjectId(cycleId);
      }
    }

    if (managerId && managerId !== 'all') {
      if (mongoose.Types.ObjectId.isValid(managerId)) {
        query.managerId = new mongoose.Types.ObjectId(managerId);
      }
    }

    if (employeeId && employeeId !== 'all') {
      if (mongoose.Types.ObjectId.isValid(employeeId)) {
        query.employeeId = new mongoose.Types.ObjectId(employeeId);
      }
    }

    // Fetch manager reviews
    const managerReviews = await ManagerReview.find(query)
      .populate('cycleId', 'name startDate endDate status')
      .populate('employeeId', 'name employeeId email')
      .populate('managerId', 'name employeeId email')
      .sort({ submittedAt: -1, updatedAt: -1 });

    // Fetch self reviews for the same cycles/employees if needed
    // We'll combine them with manager reviews to show complete appraisal data
    const selfReviewQuery: any = {};
    if (cycleId && cycleId !== 'all') {
      if (mongoose.Types.ObjectId.isValid(cycleId)) {
        selfReviewQuery.cycleId = new mongoose.Types.ObjectId(cycleId);
      }
    }
    if (employeeId && employeeId !== 'all') {
      if (mongoose.Types.ObjectId.isValid(employeeId)) {
        selfReviewQuery.employeeId = new mongoose.Types.ObjectId(employeeId);
      }
    }

    const selfReviews = await SelfReview.find(selfReviewQuery)
      .populate('cycleId', 'name startDate endDate status')
      .populate('employeeId', 'name employeeId email')
      .sort({ submittedAt: -1, updatedAt: -1 });

    // Create a map of manager reviews by cycleId and employeeId for easy lookup
    const managerReviewMap = new Map();
    managerReviews.forEach((review: any) => {
      if (review.cycleId && review.employeeId) {
        const cycleIdStr = review.cycleId._id?.toString() || review.cycleId.toString();
        const employeeIdStr = review.employeeId._id?.toString() || review.employeeId.toString();
        const key = `${cycleIdStr}-${employeeIdStr}`;
        managerReviewMap.set(key, review);
      }
    });

    // Combine self reviews with manager reviews
    // For reports, we want to show manager reviews primarily, but also include self-review data
    const combinedReports: any[] = [];

    // Add all manager reviews (these are the primary reports)
    managerReviews.forEach((review: any) => {
      if (review.cycleId && review.cycleId !== null && review.cycleId !== undefined) {
        // Find corresponding self review
        const cycleIdStr = review.cycleId._id?.toString() || review.cycleId.toString();
        const employeeIdStr = review.employeeId._id?.toString() || review.employeeId.toString();
        const selfReviewKey = `${cycleIdStr}-${employeeIdStr}`;
        
        const selfReview = selfReviews.find((sr: any) => {
          const srCycleIdStr = sr.cycleId._id?.toString() || sr.cycleId.toString();
          const srEmployeeIdStr = sr.employeeId._id?.toString() || sr.employeeId.toString();
          const srKey = `${srCycleIdStr}-${srEmployeeIdStr}`;
          return srKey === selfReviewKey;
        });

        combinedReports.push({
          ...review.toObject(),
          selfReview: selfReview ? {
            ratings: selfReview.ratings,
            comments: selfReview.comments,
            status: selfReview.status,
            submittedAt: selfReview.submittedAt,
          } : null,
        });
      }
    });

    // Also add self reviews that don't have manager reviews yet (for visibility)
    // This is especially important for closed cycles where we want to see all employee reviews
    selfReviews.forEach((selfReview: any) => {
      if (selfReview.cycleId && selfReview.cycleId !== null && selfReview.cycleId !== undefined) {
        const cycleIdStr = selfReview.cycleId._id?.toString() || selfReview.cycleId.toString();
        const employeeIdStr = selfReview.employeeId._id?.toString() || selfReview.employeeId.toString();
        const key = `${cycleIdStr}-${employeeIdStr}`;
        
        if (!managerReviewMap.has(key)) {
          // This is a self review without a manager review yet
          // We'll include it in reports but mark it as incomplete
          combinedReports.push({
            _id: `self-${selfReview._id}`,
            cycleId: selfReview.cycleId,
            employeeId: selfReview.employeeId,
            managerId: null, // No manager review yet
            ratings: {},
            managerComments: '',
            finalRating: 'Pending',
            status: 'draft' as const,
            submittedAt: null,
            selfReview: {
              ratings: selfReview.ratings,
              comments: selfReview.comments,
              status: selfReview.status,
              submittedAt: selfReview.submittedAt,
            },
            isIncomplete: true, // Flag to indicate this is only a self-review
          });
        }
      }
    });

    return NextResponse.json(combinedReports);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

