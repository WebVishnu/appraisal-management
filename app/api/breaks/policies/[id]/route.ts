/**
 * Break Policy Management
 * PUT /api/breaks/policies/:id - Update policy
 * DELETE /api/breaks/policies/:id - Delete policy
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import BreakPolicy from '@/lib/models/BreakPolicy';
import mongoose from 'mongoose';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only HR and Admin can update policies
    if (session.user.role !== 'hr' && session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    const body = await req.json();

    const policy = await BreakPolicy.findById(id);
    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    // Update fields
    Object.keys(body).forEach((key) => {
      if (key === 'scopeIds' && Array.isArray(body[key])) {
        (policy as any)[key] = body[key].map((id: string) => new mongoose.Types.ObjectId(id));
      } else if (key === 'effectiveFrom' || key === 'effectiveTo') {
        if (body[key]) {
          (policy as any)[key] = new Date(body[key]);
        } else {
          (policy as any)[key] = null;
        }
      } else if (body[key] !== undefined) {
        (policy as any)[key] = body[key];
      }
    });

    await policy.save();

    const populatedPolicy = await BreakPolicy.findById(policy._id).populate(
      'createdBy',
      'email'
    );

    return NextResponse.json({
      message: 'Policy updated successfully',
      policy: populatedPolicy,
    });
  } catch (error: any) {
    console.error('Error updating break policy:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only HR and Admin can delete policies
    if (session.user.role !== 'hr' && session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;

    const policy = await BreakPolicy.findById(id);
    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    // Soft delete - mark as inactive
    policy.isActive = false;
    await policy.save();

    return NextResponse.json({
      message: 'Policy deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting break policy:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

