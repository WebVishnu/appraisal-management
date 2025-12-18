import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Leave from '@/lib/models/Leave';
import Employee from '@/lib/models/Employee';
import { updateLeaveBalance, hasOverlappingLeaves } from '@/lib/utils/leave';
import {
  createLeaveAttendanceRecords,
  removeLeaveAttendanceRecords,
} from '@/lib/utils/leave-attendance-integration';
import mongoose from 'mongoose';

// PUT - Approve/Reject/Cancel leave
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: leaveId } = await params;
    const body = await req.json();
    const { action, rejectionReason } = body; // action: 'approve', 'reject', 'cancel'

    if (!action || !['approve', 'reject', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await connectDB();

    // Validate leaveId format
    if (!leaveId || !mongoose.Types.ObjectId.isValid(leaveId)) {
      return NextResponse.json({ error: 'Invalid leave ID' }, { status: 400 });
    }

    // Get leave without populating first to get the raw employeeId ObjectId
    const leave = await Leave.findById(leaveId);
    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    // Get the employeeId as ObjectId (before population)
    const employeeIdObjectId = leave.employeeId instanceof mongoose.Types.ObjectId 
      ? leave.employeeId 
      : new mongoose.Types.ObjectId(leave.employeeId);
    const employeeIdString = employeeIdObjectId.toString();

    // Populate for permission checks
    await leave.populate('employeeId');

    // Check permissions
    if (action === 'cancel') {
      // Only the employee who applied can cancel, and only if pending
      if (leave.status !== 'pending') {
        return NextResponse.json(
          { error: 'Only pending leaves can be cancelled' },
          { status: 400 }
        );
      }
      if (leave.appliedBy.toString() !== session.user.id) {
        return NextResponse.json({ error: 'Unauthorized to cancel this leave' }, { status: 403 });
      }
    } else if (action === 'approve' || action === 'reject') {
      // Only managers can approve/reject
      if (session.user.role !== 'manager' && session.user.role !== 'hr' && session.user.role !== 'super_admin') {
        return NextResponse.json({ error: 'Only managers can approve/reject leaves' }, { status: 403 });
      }

      if (leave.status !== 'pending') {
        return NextResponse.json(
          { error: 'Only pending leaves can be approved/rejected' },
          { status: 400 }
        );
      }

      // Check if manager is the employee's manager
      if (session.user.role === 'manager') {
        const employee = leave.employeeId as any;
        // Get manager's employee record to compare
        const managerEmployee = await Employee.findOne({ employeeId: session.user.employeeId });
        if (!managerEmployee || !employee || employee.managerId?.toString() !== managerEmployee._id.toString()) {
          return NextResponse.json(
            { error: 'You can only approve/reject leaves for your team members' },
            { status: 403 }
          );
        }
      }
    }

    // Update leave status
    if (action === 'approve') {
      leave.status = 'approved';
      leave.approvedBy = new mongoose.Types.ObjectId(session.user.id);
      leave.approvedAt = new Date();

      // Update leave balance - use the ObjectId string
      if (leave.leaveType !== 'unpaid') {
        await updateLeaveBalance(
          employeeIdString,
          leave.leaveType,
          leave.numberOfDays,
          'add'
        );
      }

      // Create attendance records for leave days - use the ObjectId string
      await createLeaveAttendanceRecords(
        employeeIdString,
        leave.startDate,
        leave.endDate,
        leave.leaveType
      );
    } else if (action === 'reject') {
      leave.status = 'rejected';
      leave.approvedBy = new mongoose.Types.ObjectId(session.user.id);
      leave.approvedAt = new Date();
      if (rejectionReason) {
        leave.rejectionReason = rejectionReason;
      }
    } else if (action === 'cancel') {
      // If cancelling an approved leave, reverse the balance and remove attendance records
      if (leave.status === 'approved') {
        if (leave.leaveType !== 'unpaid') {
          await updateLeaveBalance(
            employeeIdString,
            leave.leaveType,
            leave.numberOfDays,
            'subtract'
          );
        }
        // Remove attendance records created for this leave
        await removeLeaveAttendanceRecords(
          employeeIdString,
          leave.startDate,
          leave.endDate
        );
      }
      leave.status = 'cancelled';
    }

    await leave.save();

    const populatedLeave = await Leave.findById(leave._id)
      .populate('employeeId', 'name employeeId email')
      .populate('appliedBy', 'email')
      .populate('approvedBy', 'email');

    return NextResponse.json({
      message: `Leave ${action}d successfully`,
      leave: populatedLeave,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/leaves/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete leave (HR/Admin only, or employee for pending leaves)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: leaveId } = await params;

    await connectDB();

    // Validate leaveId format
    if (!leaveId || !mongoose.Types.ObjectId.isValid(leaveId)) {
      return NextResponse.json({ error: 'Invalid leave ID' }, { status: 400 });
    }

    const leave = await Leave.findById(leaveId);
    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    // Get the employeeId as ObjectId string (before any population)
    const employeeIdObjectId = leave.employeeId instanceof mongoose.Types.ObjectId 
      ? leave.employeeId 
      : new mongoose.Types.ObjectId(leave.employeeId);
    const employeeIdString = employeeIdObjectId.toString();

    // Check permissions
    const isHR = session.user.role === 'hr' || session.user.role === 'super_admin';
    const isOwner = leave.appliedBy.toString() === session.user.id;

    if (!isHR && (!isOwner || leave.status !== 'pending')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // If approved leave is being deleted, reverse the balance and remove attendance records
    if (leave.status === 'approved') {
      if (leave.leaveType !== 'unpaid') {
        await updateLeaveBalance(
          employeeIdString,
          leave.leaveType,
          leave.numberOfDays,
          'subtract'
        );
      }
      // Remove attendance records created for this leave
      await removeLeaveAttendanceRecords(
        employeeIdString,
        leave.startDate,
        leave.endDate
      );
    }

    await Leave.findByIdAndDelete(leaveId);

    return NextResponse.json({ message: 'Leave deleted successfully' });
  } catch (error: any) {
    console.error('Error in DELETE /api/leaves/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

