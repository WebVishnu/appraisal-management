import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import AppraisalCycle from '@/lib/models/AppraisalCycle';

// GET - Get active cycles for employees/managers
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const query: any = {};
    if (status) {
      query.status = status;
    } else {
      // For employees, show cycles open for self review or closed
      if (session.user.role === 'employee') {
        query.status = { $in: ['open_self_review', 'closed'] };
      }
      // For managers, show cycles open for manager review or closed
      else if (session.user.role === 'manager') {
        query.status = { $in: ['open_manager_review', 'closed'] };
      }
    }

    const cycles = await AppraisalCycle.find(query)
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 });

    return NextResponse.json(cycles);
  } catch (error) {
    console.error('Error fetching active cycles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

