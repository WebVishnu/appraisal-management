import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Roster from '@/lib/models/Roster';
import Shift from '@/lib/models/Shift';
import Employee from '@/lib/models/Employee';
import { z } from 'zod';
import mongoose from 'mongoose';
import { checkShiftConflicts, getDayOfWeek } from '@/lib/utils/shift';
import Leave from '@/lib/models/Leave';

const createRosterSchema = z.object({
  employeeId: z.string(),
  shiftId: z.string(),
  date: z.string(),
  isWeeklyOff: z.boolean().default(false),
  notes: z.string().optional(),
});

const bulkCreateRosterSchema = z.object({
  employeeIds: z.array(z.string()).min(1),
  shiftId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  isWeeklyOff: z.boolean().default(false),
  notes: z.string().optional(),
});

// GET - Get roster entries
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const weekNumber = searchParams.get('weekNumber');

    const query: any = {};

    // Role-based filtering
    if (session.user.role === 'employee') {
      const employee = await Employee.findOne({ email: session.user.email });
      if (employee) {
        query.employeeId = employee._id;
      } else {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
      }
    } else if (session.user.role === 'manager') {
      const manager = await Employee.findOne({ email: session.user.email });
      if (manager) {
        const teamEmployees = await Employee.find({ managerId: manager._id, isActive: true }).select('_id');
        query.employeeId = { $in: teamEmployees.map((e) => e._id) };
      }
    }

    if (employeeId) query.employeeId = employeeId;
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    if (year) query.year = parseInt(year);
    if (month) query.month = parseInt(month);
    if (weekNumber) query.weekNumber = parseInt(weekNumber);

    const rosters = await Roster.find(query)
      .populate('employeeId', 'name employeeId email')
      .populate('shiftId')
      .populate('createdBy', 'email name')
      .sort({ date: 1, employeeId: 1 });

    return NextResponse.json(rosters);
  } catch (error) {
    console.error('Error fetching roster:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create roster entry (single or bulk)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin' && session.user.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();

    // Check if bulk creation
    if (body.employeeIds && Array.isArray(body.employeeIds)) {
      const validatedData = bulkCreateRosterSchema.parse(body);
      const startDate = new Date(validatedData.startDate);
      const endDate = new Date(validatedData.endDate);

      // Verify shift exists
      const shift = await Shift.findById(validatedData.shiftId);
      if (!shift) {
        return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
      }

      // Get User ID for createdBy (once, not in loop)
      let createdByUserId: mongoose.Types.ObjectId;
      if (session.user.id) {
        createdByUserId = new mongoose.Types.ObjectId(session.user.id);
      } else {
        const { default: User } = await import('@/lib/models/User');
        const user = await User.findOne({ email: session.user.email });
        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        createdByUserId = user._id;
      }

      // Convert employee IDs to ObjectIds
      const employeeObjectIds = validatedData.employeeIds.map(id => new mongoose.Types.ObjectId(id));
      const shiftObjectId = new mongoose.Types.ObjectId(validatedData.shiftId);

      // Generate all dates
      const dates: Date[] = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Build query to find all existing rosters in one go
      const dateRange = dates.map(d => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        return date;
      });

      const existingRosters = await Roster.find({
        employeeId: { $in: employeeObjectIds },
        date: { $in: dateRange },
      }).lean();

      // Create a map for quick lookup
      const existingMap = new Map<string, any>();
      existingRosters.forEach((r: any) => {
        const key = `${r.employeeId.toString()}_${r.date.toISOString().split('T')[0]}`;
        existingMap.set(key, r);
      });

      // Pre-fetch leaves for conflict checking (bulk query)
      const leaveDates = dateRange.map(d => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        return date;
      });

      const leaves = await Leave.find({
        employeeId: { $in: employeeObjectIds },
        status: { $in: ['pending', 'approved'] },
        $or: leaveDates.map(date => ({
          startDate: { $lte: date },
          endDate: { $gte: date },
        })),
      }).lean();

      // Create leave map for quick conflict checking
      const leaveMap = new Map<string, boolean>();
      leaves.forEach((leave: any) => {
        const empId = leave.employeeId.toString();
        const leaveStart = new Date(leave.startDate);
        const leaveEnd = new Date(leave.endDate);
        dateRange.forEach(date => {
          if (date >= leaveStart && date <= leaveEnd) {
            const key = `${empId}_${date.toISOString().split('T')[0]}`;
            leaveMap.set(key, true);
          }
        });
      });

      // Prepare bulk operations
      const bulkOps: any[] = [];
      const errors: any[] = [];
      const newRosterDates: { employeeId: mongoose.Types.ObjectId; date: Date }[] = [];

      // Process each employee-date combination
      for (const empId of employeeObjectIds) {
        for (const date of dates) {
          const dateKey = date.toISOString().split('T')[0];
          const lookupKey = `${empId.toString()}_${dateKey}`;
          const existing = existingMap.get(lookupKey);

          // Check for leave conflicts (skip if weekly off)
          if (!validatedData.isWeeklyOff) {
            const hasLeave = leaveMap.get(lookupKey);
            if (hasLeave) {
              errors.push({
                employeeId: empId.toString(),
                date: dateKey,
                error: 'Employee has approved/pending leave on this date',
              });
              continue;
            }

            // Check if shift is active on this day
            const dayOfWeek = getDayOfWeek(date);
            if (!shift.workingDays.includes(dayOfWeek as any)) {
              errors.push({
                employeeId: empId.toString(),
                date: dateKey,
                error: `Shift is not active on ${dayOfWeek}`,
              });
              continue;
            }
          }

          if (existing) {
            // Update existing roster
            bulkOps.push({
              updateOne: {
                filter: { _id: existing._id },
                update: {
                  $set: {
                    shiftId: shiftObjectId,
                    isWeeklyOff: validatedData.isWeeklyOff,
                    notes: validatedData.notes || '',
                    year: date.getFullYear(),
                    month: date.getMonth() + 1,
                  },
                },
              },
            });
          } else {
            // Track new rosters to insert
            newRosterDates.push({ employeeId: empId, date: new Date(date) });
            
            // Insert new roster
            const newRoster = {
              employeeId: empId,
              shiftId: shiftObjectId,
              date: new Date(date),
              isWeeklyOff: validatedData.isWeeklyOff,
              notes: validatedData.notes || '',
              year: date.getFullYear(),
              month: date.getMonth() + 1,
              createdBy: createdByUserId,
            };
            bulkOps.push({
              insertOne: {
                document: newRoster,
              },
            });
          }
        }
      }

      // Execute bulk operations
      if (bulkOps.length > 0) {
        await Roster.bulkWrite(bulkOps, { ordered: false });
      }

      // Fetch all created/updated rosters with population
      const allRosters = await Roster.find({
        employeeId: { $in: employeeObjectIds },
        date: { $in: dateRange },
      })
        .populate('employeeId', 'name employeeId email')
        .populate('shiftId')
        .populate('createdBy', 'email name')
        .sort({ date: 1, employeeId: 1 })
        .lean();

      return NextResponse.json(
        {
          created: allRosters.length,
          errors: errors.length > 0 ? errors : undefined,
          rosters: allRosters,
        },
        { status: 201 }
      );
    } else {
      // Single roster creation
      const validatedData = createRosterSchema.parse(body);
      const date = new Date(validatedData.date);

      // Verify shift exists
      const shift = await Shift.findById(validatedData.shiftId);
      if (!shift) {
        return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
      }

      // Verify employee exists
      const employee = await Employee.findById(validatedData.employeeId);
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      // Check conflicts
      if (!validatedData.isWeeklyOff) {
        const conflicts = await checkShiftConflicts(validatedData.employeeId, date, validatedData.shiftId);
        if (conflicts.hasConflict) {
          return NextResponse.json(
            { error: 'Roster conflicts detected', conflicts: conflicts.conflicts },
            { status: 400 }
          );
        }
      }

      // Check if roster entry already exists
      const existingRoster = await Roster.findOne({
        employeeId: validatedData.employeeId,
        date: date,
      });

      if (existingRoster) {
        // Update existing
        existingRoster.shiftId = new mongoose.Types.ObjectId(validatedData.shiftId);
        existingRoster.isWeeklyOff = validatedData.isWeeklyOff;
        existingRoster.notes = validatedData.notes;
        existingRoster.year = date.getFullYear();
        existingRoster.month = date.getMonth() + 1;
        await existingRoster.save();
        await existingRoster.populate('employeeId', 'name employeeId email');
        await existingRoster.populate('shiftId');
        return NextResponse.json(existingRoster);
      }

      // Get User ID for createdBy
      let createdByUserId: mongoose.Types.ObjectId;
      if (session.user.id) {
        createdByUserId = new mongoose.Types.ObjectId(session.user.id);
      } else {
        const { default: User } = await import('@/lib/models/User');
        const user = await User.findOne({ email: session.user.email });
        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        createdByUserId = user._id;
      }

      const roster = new Roster({
        employeeId: new mongoose.Types.ObjectId(validatedData.employeeId),
        shiftId: new mongoose.Types.ObjectId(validatedData.shiftId),
        date: date,
        isWeeklyOff: validatedData.isWeeklyOff,
        notes: validatedData.notes,
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        createdBy: createdByUserId,
      });

      await roster.save();
      await roster.populate('employeeId', 'name employeeId email');
      await roster.populate('shiftId');

      return NextResponse.json(roster, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating roster:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

