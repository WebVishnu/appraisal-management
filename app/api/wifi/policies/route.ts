import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import WiFiPolicy from '@/lib/models/WiFiPolicy';
import { z } from 'zod';

const createPolicySchema = z.object({
  name: z.string().min(1, 'Policy name is required'),
  description: z.string().optional(),
  scope: z.enum(['company', 'office', 'department', 'shift', 'employee']),
  scopeIds: z.object({
    officeId: z.string().optional(),
    departmentId: z.string().optional(),
    shiftId: z.string().optional(),
    employeeId: z.string().optional(),
  }).optional(),
  requireWiFi: z.boolean().default(true),
  allowedNetworks: z.array(z.string()).default([]),
  allowOverride: z.boolean().default(true),
  requireOverrideReason: z.boolean().default(true),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  timeRange: z.object({
    start: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
    end: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  }).optional(),
  status: z.enum(['active', 'inactive', 'scheduled']).default('active'),
  isActive: z.boolean().default(true),
});

const updatePolicySchema = createPolicySchema.partial();

// GET - List all WiFi policies
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const isActive = searchParams.get('isActive');
    const scope = searchParams.get('scope');

    let query: any = {};

    if (isActive !== null) {
      query.isActive = isActive === 'true';
    }

    if (scope) {
      query.scope = scope;
    }

    const policies = await WiFiPolicy.find(query)
      .populate('allowedNetworks')
      .populate('createdBy', 'email')
      .populate('updatedBy', 'email')
      .sort({ createdAt: -1 })
      .limit(200);

    return NextResponse.json(policies);
  } catch (error) {
    console.error('Error fetching WiFi policies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new WiFi policy
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createPolicySchema.parse(body);

    await connectDB();

    // Convert string IDs to ObjectIds
    const scopeIds: any = {};
    if (validatedData.scopeIds) {
      if (validatedData.scopeIds.officeId) {
        scopeIds.officeId = validatedData.scopeIds.officeId;
      }
      if (validatedData.scopeIds.departmentId) {
        scopeIds.departmentId = validatedData.scopeIds.departmentId;
      }
      if (validatedData.scopeIds.shiftId) {
        const mongoose = (await import('mongoose')).default;
        scopeIds.shiftId = new mongoose.Types.ObjectId(validatedData.scopeIds.shiftId);
      }
      if (validatedData.scopeIds.employeeId) {
        const mongoose = (await import('mongoose')).default;
        scopeIds.employeeId = new mongoose.Types.ObjectId(validatedData.scopeIds.employeeId);
      }
    }

    // Convert network IDs to ObjectIds
    const mongoose = (await import('mongoose')).default;
    const allowedNetworks = validatedData.allowedNetworks.map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    const policy = await WiFiPolicy.create({
      ...validatedData,
      scopeIds,
      allowedNetworks,
      effectiveFrom: validatedData.effectiveFrom ? new Date(validatedData.effectiveFrom) : undefined,
      effectiveTo: validatedData.effectiveTo ? new Date(validatedData.effectiveTo) : undefined,
      createdBy: session.user.id,
    });

    const populated = await WiFiPolicy.findById(policy._id)
      .populate('allowedNetworks')
      .populate('createdBy', 'email');

    return NextResponse.json(populated, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating WiFi policy:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update WiFi policy
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400 });
    }

    const validatedData = updatePolicySchema.parse(updateData);

    await connectDB();

    const policy = await WiFiPolicy.findById(id);
    if (!policy) {
      return NextResponse.json({ error: 'WiFi policy not found' }, { status: 404 });
    }

    // Update policy
    if (validatedData.scopeIds) {
      const scopeIds: any = {};
      if (validatedData.scopeIds.officeId) scopeIds.officeId = validatedData.scopeIds.officeId;
      if (validatedData.scopeIds.departmentId) scopeIds.departmentId = validatedData.scopeIds.departmentId;
      if (validatedData.scopeIds.shiftId) {
        const mongoose = (await import('mongoose')).default;
        scopeIds.shiftId = new mongoose.Types.ObjectId(validatedData.scopeIds.shiftId);
      }
      if (validatedData.scopeIds.employeeId) {
        const mongoose = (await import('mongoose')).default;
        scopeIds.employeeId = new mongoose.Types.ObjectId(validatedData.scopeIds.employeeId);
      }
      policy.scopeIds = { ...policy.scopeIds, ...scopeIds };
    }

    if (validatedData.allowedNetworks) {
      const mongoose = (await import('mongoose')).default;
      policy.allowedNetworks = validatedData.allowedNetworks.map(
        (id) => new mongoose.Types.ObjectId(id)
      );
    }

    Object.assign(policy, {
      ...validatedData,
      effectiveFrom: validatedData.effectiveFrom ? new Date(validatedData.effectiveFrom) : policy.effectiveFrom,
      effectiveTo: validatedData.effectiveTo ? new Date(validatedData.effectiveTo) : policy.effectiveTo,
      updatedBy: session.user.id,
    });

    await policy.save();

    const populated = await WiFiPolicy.findById(policy._id)
      .populate('allowedNetworks')
      .populate('createdBy', 'email')
      .populate('updatedBy', 'email');

    return NextResponse.json(populated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error updating WiFi policy:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete WiFi policy
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400 });
    }

    await connectDB();

    const policy = await WiFiPolicy.findById(id);
    if (!policy) {
      return NextResponse.json({ error: 'WiFi policy not found' }, { status: 404 });
    }

    await WiFiPolicy.findByIdAndDelete(id);

    return NextResponse.json({ message: 'WiFi policy deleted successfully' });
  } catch (error) {
    console.error('Error deleting WiFi policy:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

