import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import SelfReview from '@/lib/models/SelfReview';
import AppraisalCycle from '@/lib/models/AppraisalCycle';
import Employee from '@/lib/models/Employee';
import { z } from 'zod';

const createSelfReviewSchema = z.object({
  cycleId: z.string(),
  ratings: z.record(z.string(), z.union([z.number(), z.string()])),
  comments: z.string().optional(),
  status: z.enum(['draft', 'submitted']).optional(),
});

// GET - Get self reviews for current employee
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycleId');

    const query: any = { employeeId: session.user.employeeId };
    if (cycleId) {
      query.cycleId = cycleId;
    }

    const reviews = await SelfReview.find(query)
      .populate('cycleId', 'name status startDate endDate competencies')
      .sort({ createdAt: -1 });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Error fetching self reviews:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or update self review
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createSelfReviewSchema.parse(body);

    await connectDB();

    // Verify cycle exists and is in correct status
    const cycle = await AppraisalCycle.findById(validatedData.cycleId);
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    // Check if submitting
    if (validatedData.status === 'submitted') {
      if (cycle.status !== 'open_self_review') {
        return NextResponse.json(
          { error: 'Cycle is not open for self review' },
          { status: 400 }
        );
      }
    }

    // Verify employee exists
    const employee = await Employee.findById(session.user.employeeId);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Check if review already exists
    const existingReview = await SelfReview.findOne({
      cycleId: validatedData.cycleId,
      employeeId: session.user.employeeId,
    });

    let review;

    if (existingReview) {
      // Update existing review
      if (existingReview.status === 'submitted') {
        return NextResponse.json(
          { error: 'Cannot edit submitted review' },
          { status: 400 }
        );
      }

      existingReview.ratings = validatedData.ratings;
      existingReview.comments = validatedData.comments || '';
      if (validatedData.status === 'submitted') {
        existingReview.status = 'submitted';
        existingReview.submittedAt = new Date();
      }
      await existingReview.save();
      review = existingReview;
    } else {
      // Create new review
      review = await SelfReview.create({
        cycleId: validatedData.cycleId,
        employeeId: session.user.employeeId,
        ratings: validatedData.ratings,
        comments: validatedData.comments || '',
        status: validatedData.status || 'draft',
        submittedAt: validatedData.status === 'submitted' ? new Date() : null,
      });
    }

    const populatedReview = await SelfReview.findById(review._id).populate(
      'cycleId',
      'name status startDate endDate competencies'
    );

    return NextResponse.json(populatedReview, { status: existingReview ? 200 : 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error saving self review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

