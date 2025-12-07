import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import ManagerReview from '@/lib/models/ManagerReview';
import AppraisalCycle from '@/lib/models/AppraisalCycle';
import Employee from '@/lib/models/Employee';
import { z } from 'zod';

const createManagerReviewSchema = z.object({
  cycleId: z.string(),
  employeeId: z.string(),
  ratings: z.record(z.string(), z.union([z.number(), z.string()])),
  managerComments: z.string().optional(),
  finalRating: z.string().min(1),
  status: z.enum(['draft', 'submitted']).optional(),
});

// GET - Get manager reviews for current manager
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycleId');
    const employeeId = searchParams.get('employeeId');

    const query: any = { managerId: session.user.employeeId };
    if (cycleId) {
      query.cycleId = cycleId;
    }
    if (employeeId) {
      query.employeeId = employeeId;
    }

    const reviews = await ManagerReview.find(query)
      .populate('cycleId', 'name status startDate endDate competencies')
      .populate('employeeId', 'name employeeId email')
      .sort({ createdAt: -1 });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Error fetching manager reviews:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or update manager review
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createManagerReviewSchema.parse(body);

    await connectDB();

    // Verify cycle exists and is in correct status
    const cycle = await AppraisalCycle.findById(validatedData.cycleId);
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    // Check if submitting
    if (validatedData.status === 'submitted') {
      if (cycle.status !== 'open_manager_review') {
        return NextResponse.json(
          { error: 'Cycle is not open for manager review' },
          { status: 400 }
        );
      }
    }

    // Verify employee exists and manager is assigned
    const employee = await Employee.findById(validatedData.employeeId);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (employee.managerId?.toString() !== session.user.employeeId) {
      return NextResponse.json(
        { error: 'You are not the manager of this employee' },
        { status: 403 }
      );
    }

    // Managers can now give reviews regardless of whether employee has submitted self-review
    // This allows managers to provide feedback independently

    // Check if review already exists
    const existingReview = await ManagerReview.findOne({
      cycleId: validatedData.cycleId,
      employeeId: validatedData.employeeId,
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
      existingReview.managerComments = validatedData.managerComments || '';
      existingReview.finalRating = validatedData.finalRating;
      if (validatedData.status === 'submitted') {
        existingReview.status = 'submitted';
        existingReview.submittedAt = new Date();
      }
      await existingReview.save();
      review = existingReview;
    } else {
      // Create new review
      review = await ManagerReview.create({
        cycleId: validatedData.cycleId,
        employeeId: validatedData.employeeId,
        managerId: session.user.employeeId,
        ratings: validatedData.ratings,
        managerComments: validatedData.managerComments || '',
        finalRating: validatedData.finalRating,
        status: validatedData.status || 'draft',
        submittedAt: validatedData.status === 'submitted' ? new Date() : null,
      });
    }

    const populatedReview = await ManagerReview.findById(review._id)
      .populate('cycleId', 'name status startDate endDate competencies')
      .populate('employeeId', 'name employeeId email');

    return NextResponse.json(populatedReview, { status: existingReview ? 200 : 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error saving manager review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

