// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../lib/mongodb';
import User from '../lib/models/User';
import Employee from '../lib/models/Employee';
import AppraisalCycle from '../lib/models/AppraisalCycle';
import Shift from '../lib/models/Shift';
import ShiftAssignment from '../lib/models/ShiftAssignment';
import Roster from '../lib/models/Roster';
import LeaveBalance from '../lib/models/LeaveBalance';
import Leave from '../lib/models/Leave';
import Attendance from '../lib/models/Attendance';
import WorkReport from '../lib/models/WorkReport';
import SelfReview from '../lib/models/SelfReview';
import ManagerReview from '../lib/models/ManagerReview';
import Notification from '../lib/models/Notification';
import ShiftSwap from '../lib/models/ShiftSwap';

async function seed() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Employee.deleteMany({});
    await AppraisalCycle.deleteMany({});
    await Shift.deleteMany({});
    await ShiftAssignment.deleteMany({});
    await Roster.deleteMany({});
    await LeaveBalance.deleteMany({});
    await Leave.deleteMany({});
    await Attendance.deleteMany({});
    await WorkReport.deleteMany({});
    await SelfReview.deleteMany({});
    await ManagerReview.deleteMany({});
    await Notification.deleteMany({});
    await ShiftSwap.deleteMany({});
    console.log('Cleared existing data');

    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 10);
    const currentYear = new Date().getFullYear();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ========== CREATE SUPER ADMIN ==========
    const superAdminEmployee = await Employee.create({
      employeeId: 'ADMIN001',
      name: 'Super Admin',
      email: 'admin@company.com',
      role: 'Super Admin',
      isActive: true,
    });

    const superAdminUser = await User.create({
      email: 'admin@company.com',
      password: hashedPassword,
      role: 'super_admin',
      employeeId: superAdminEmployee._id,
      isActive: true,
    });
    console.log('Created Super Admin');

    // ========== CREATE HR ==========
    const hrEmployee = await Employee.create({
      employeeId: 'HR001',
      name: 'Sarah Johnson',
      email: 'hr@company.com',
      role: 'HR Manager',
      isActive: true,
    });

    const hrUser = await User.create({
      email: 'hr@company.com',
      password: hashedPassword,
      role: 'hr',
      employeeId: hrEmployee._id,
      isActive: true,
    });
    console.log('Created HR');

    // ========== CREATE MANAGERS ==========
    const manager1 = await Employee.create({
      employeeId: 'MGR001',
      name: 'John Manager',
      email: 'manager@company.com',
      role: 'Engineering Manager',
      isActive: true,
    });

    const manager1User = await User.create({
      email: 'manager@company.com',
      password: hashedPassword,
      role: 'manager',
      employeeId: manager1._id,
      isActive: true,
    });

    const manager2 = await Employee.create({
      employeeId: 'MGR002',
      name: 'Emily Chen',
      email: 'manager2@company.com',
      role: 'Product Manager',
      isActive: true,
    });

    const manager2User = await User.create({
      email: 'manager2@company.com',
      password: hashedPassword,
      role: 'manager',
      employeeId: manager2._id,
      isActive: true,
    });

    const manager3 = await Employee.create({
      employeeId: 'MGR003',
      name: 'Michael Brown',
      email: 'manager3@company.com',
      role: 'Sales Manager',
      isActive: true,
    });

    const manager3User = await User.create({
      email: 'manager3@company.com',
      password: hashedPassword,
      role: 'manager',
      employeeId: manager3._id,
      isActive: true,
    });
    console.log('Created 3 Managers');

    // ========== CREATE EMPLOYEES ==========
    const employees = [];
    const employeeUsers = [];

    // Engineering Team (under manager1)
    const empData = [
      { id: 'EMP001', name: 'Alice Smith', email: 'alice@company.com', role: 'Senior Software Engineer', manager: manager1 },
      { id: 'EMP002', name: 'Bob Wilson', email: 'bob@company.com', role: 'Software Engineer', manager: manager1 },
      { id: 'EMP003', name: 'Charlie Davis', email: 'charlie@company.com', role: 'Frontend Developer', manager: manager1 },
      { id: 'EMP004', name: 'Diana Martinez', email: 'diana@company.com', role: 'Backend Developer', manager: manager1 },
      { id: 'EMP005', name: 'Ethan Taylor', email: 'ethan@company.com', role: 'DevOps Engineer', manager: manager1 },
      
      // Product Team (under manager2)
      { id: 'EMP006', name: 'Fiona Anderson', email: 'fiona@company.com', role: 'Product Designer', manager: manager2 },
      { id: 'EMP007', name: 'George Lee', email: 'george@company.com', role: 'UX Designer', manager: manager2 },
      { id: 'EMP008', name: 'Hannah White', email: 'hannah@company.com', role: 'Product Analyst', manager: manager2 },
      
      // Sales Team (under manager3)
      { id: 'EMP009', name: 'Ian Thompson', email: 'ian@company.com', role: 'Sales Executive', manager: manager3 },
      { id: 'EMP010', name: 'Julia Garcia', email: 'julia@company.com', role: 'Account Manager', manager: manager3 },
      { id: 'EMP011', name: 'Kevin Rodriguez', email: 'kevin@company.com', role: 'Business Development', manager: manager3 },
      
      // Additional employees
      { id: 'EMP012', name: 'Lisa Wang', email: 'lisa@company.com', role: 'QA Engineer', manager: manager1 },
      { id: 'EMP013', name: 'Mark Johnson', email: 'mark@company.com', role: 'Technical Writer', manager: manager1 },
      { id: 'EMP014', name: 'Nancy Kim', email: 'nancy@company.com', role: 'Marketing Specialist', manager: manager2 },
      { id: 'EMP015', name: 'Oliver Moore', email: 'oliver@company.com', role: 'Customer Success', manager: manager3 },
    ];

    for (const emp of empData) {
      const employee = await Employee.create({
        employeeId: emp.id,
        name: emp.name,
        email: emp.email,
        role: emp.role,
        managerId: emp.manager._id,
      isActive: true,
    });

      const user = await User.create({
        email: emp.email,
      password: hashedPassword,
      role: 'employee',
        employeeId: employee._id,
        isActive: true,
      });

      employees.push(employee);
      employeeUsers.push(user);
    }
    console.log(`Created ${employees.length} Employees`);

    // ========== CREATE SHIFTS ==========
    const shifts = [];

    const shiftData = [
      {
        name: 'Morning Shift',
        shiftType: 'fixed',
        startTime: '09:00',
        endTime: '18:00',
        gracePeriod: 15,
        earlyExitGracePeriod: 15,
        minimumWorkingHours: 480, // 8 hours
        breakDuration: 60,
        isBreakPaid: false,
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        isNightShift: false,
        description: 'Standard 9 AM to 6 PM shift',
      },
      {
        name: 'Evening Shift',
        shiftType: 'fixed',
        startTime: '14:00',
        endTime: '23:00',
        gracePeriod: 15,
        earlyExitGracePeriod: 15,
        minimumWorkingHours: 480,
        breakDuration: 60,
        isBreakPaid: false,
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        isNightShift: false,
        description: 'Evening shift for support team',
      },
      {
        name: 'Night Shift',
        shiftType: 'fixed',
        startTime: '22:00',
        endTime: '06:00',
        gracePeriod: 15,
        earlyExitGracePeriod: 15,
        minimumWorkingHours: 480,
        breakDuration: 60,
        isBreakPaid: true,
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        isNightShift: true,
        description: 'Night shift for 24/7 operations',
      },
      {
        name: 'Flexible Shift',
        shiftType: 'flexible',
        startTime: '08:00',
        endTime: '17:00',
        gracePeriod: 30,
        earlyExitGracePeriod: 30,
        minimumWorkingHours: 360, // 6 hours
        breakDuration: 60,
        isBreakPaid: false,
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        isNightShift: false,
        description: 'Flexible working hours',
      },
      {
        name: 'Weekend Shift',
        shiftType: 'rotational',
        startTime: '10:00',
        endTime: '19:00',
        gracePeriod: 15,
        earlyExitGracePeriod: 15,
        minimumWorkingHours: 480,
        breakDuration: 60,
        isBreakPaid: false,
        workingDays: ['saturday', 'sunday'],
        isNightShift: false,
        description: 'Weekend rotational shift',
      },
    ];

    for (const shiftInfo of shiftData) {
      const shift = await Shift.create({
        ...shiftInfo,
        createdBy: hrUser._id,
        isActive: true,
      });
      shifts.push(shift);
    }
    console.log(`Created ${shifts.length} Shifts`);

    // ========== CREATE SHIFT ASSIGNMENTS ==========
    // Assign Morning Shift to Engineering Team (permanent)
    await ShiftAssignment.create({
      shiftId: shifts[0]._id, // Morning Shift
      assignmentType: 'permanent',
      assignmentScope: 'team',
      teamManagerId: manager1._id,
      effectiveDate: new Date('2024-01-01'),
      assignedBy: hrUser._id,
      reason: 'Standard shift for engineering team',
      isActive: true,
    });

    // Assign Evening Shift to Sales Team (permanent)
    await ShiftAssignment.create({
      shiftId: shifts[1]._id, // Evening Shift
      assignmentType: 'permanent',
      assignmentScope: 'team',
      teamManagerId: manager3._id,
      effectiveDate: new Date('2024-01-01'),
      assignedBy: hrUser._id,
      reason: 'Evening shift for sales team',
      isActive: true,
    });

    // Assign Flexible Shift to Product Team (permanent)
    await ShiftAssignment.create({
      shiftId: shifts[3]._id, // Flexible Shift
      assignmentType: 'permanent',
      assignmentScope: 'team',
      teamManagerId: manager2._id,
      effectiveDate: new Date('2024-01-01'),
      assignedBy: hrUser._id,
      reason: 'Flexible hours for product team',
      isActive: true,
    });

    // Assign Night Shift to specific employees (permanent)
    await ShiftAssignment.create({
      shiftId: shifts[2]._id, // Night Shift
      assignmentType: 'permanent',
      assignmentScope: 'employee',
      employeeId: employees[4]._id, // Ethan - DevOps
      effectiveDate: new Date('2024-01-01'),
      assignedBy: hrUser._id,
      reason: 'DevOps needs 24/7 coverage',
      isActive: true,
    });

    // Temporary assignment for weekend shift
    const tempStart = new Date();
    tempStart.setDate(tempStart.getDate() + 7);
    const tempEnd = new Date(tempStart);
    tempEnd.setDate(tempEnd.getDate() + 14);

    await ShiftAssignment.create({
      shiftId: shifts[4]._id, // Weekend Shift
      assignmentType: 'temporary',
      assignmentScope: 'employee',
      employeeId: employees[11]._id, // Lisa - QA Engineer
      startDate: tempStart,
      endDate: tempEnd,
      effectiveDate: tempStart,
      assignedBy: hrUser._id,
      reason: 'Temporary weekend coverage',
      isActive: true,
    });
    console.log('Created Shift Assignments');

    // ========== CREATE ROSTERS FOR CURRENT MONTH ==========
    const currentMonth = today.getMonth();
    const rosterYear = today.getFullYear();
    const daysInMonth = new Date(rosterYear, currentMonth + 1, 0).getDate();

    // Create rosters for all employees for current month
    for (let day = 1; day <= daysInMonth; day++) {
      const rosterDate = new Date(rosterYear, currentMonth, day);
      const dayOfWeek = rosterDate.getDay();
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];

      // Skip weekends for most employees (except those on weekend shift)
      if (dayName === 'saturday' || dayName === 'sunday') {
        // Only assign weekend shift to Lisa (EMP012)
        if (dayName === 'saturday' || dayName === 'sunday') {
          await Roster.create({
            employeeId: employees[11]._id, // Lisa
            shiftId: shifts[4]._id, // Weekend Shift
            date: rosterDate,
            year: rosterYear,
            month: currentMonth + 1,
            weekNumber: Math.ceil(day / 7),
            isWeeklyOff: false,
            createdBy: hrUser._id,
          });
        }
        // Mark weekly off for others
        for (let i = 0; i < employees.length; i++) {
          if (i !== 11) { // Not Lisa
            await Roster.create({
              employeeId: employees[i]._id,
              shiftId: shifts[0]._id, // Default shift
              date: rosterDate,
              year: rosterYear,
              month: currentMonth + 1,
              weekNumber: Math.ceil(day / 7),
              isWeeklyOff: true,
              createdBy: hrUser._id,
            });
          }
        }
      } else {
        // Weekday rosters
        for (let i = 0; i < employees.length; i++) {
          let assignedShift = shifts[0]._id; // Default Morning Shift
          
          // Assign based on team
          if (i < 5) {
            // Engineering team - Morning Shift
            assignedShift = shifts[0]._id;
          } else if (i >= 5 && i < 8) {
            // Product team - Flexible Shift
            assignedShift = shifts[3]._id;
          } else if (i >= 8 && i < 11) {
            // Sales team - Evening Shift
            assignedShift = shifts[1]._id;
          } else if (i === 4) {
            // Ethan - Night Shift
            assignedShift = shifts[2]._id;
          }

          await Roster.create({
            employeeId: employees[i]._id,
            shiftId: assignedShift,
            date: rosterDate,
            year: rosterYear,
            month: currentMonth + 1,
            weekNumber: Math.ceil(day / 7),
            isWeeklyOff: false,
            createdBy: hrUser._id,
          });
        }
      }
    }
    console.log(`Created Rosters for ${daysInMonth} days`);

    // ========== CREATE LEAVE BALANCES ==========
    const leaveTypes = ['paid', 'unpaid', 'sick', 'casual', 'annual'];
    const leaveBalances = {
      paid: 12,
      unpaid: 0,
      sick: 10,
      casual: 8,
      annual: 20,
    };

    for (const employee of employees) {
      for (const leaveType of leaveTypes) {
        const totalDays = leaveBalances[leaveType as keyof typeof leaveBalances];
        // Ensure usedDays never exceeds totalDays to avoid negative availableDays
        const maxUsedDays = Math.max(0, totalDays - 1); // Leave at least 1 day available, or 0 if totalDays is 0
        const usedDays = totalDays > 0 ? Math.floor(Math.random() * (maxUsedDays + 1)) : 0; // Random used days (0 to maxUsedDays)
        const availableDays = Math.max(0, totalDays - usedDays); // Ensure non-negative
        
        await LeaveBalance.create({
          employeeId: employee._id,
          leaveType: leaveType as any,
          totalDays: totalDays,
          usedDays: usedDays,
          availableDays: availableDays, // Will be recalculated by pre-save hook, but set correctly here
          year: rosterYear,
          lastUpdatedBy: hrUser._id,
          lastUpdatedAt: new Date(),
        });
      }
    }
    console.log(`Created Leave Balances for all employees`);

    // ========== CREATE LEAVE REQUESTS ==========
    // Pending leaves
    const pendingLeave1 = await Leave.create({
      employeeId: employees[0]._id, // Alice
      leaveType: 'casual',
      startDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      endDate: new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000),
      numberOfDays: 2,
      reason: 'Personal work',
      status: 'pending',
      appliedBy: employeeUsers[0]._id,
    });

    const pendingLeave2 = await Leave.create({
      employeeId: employees[1]._id, // Bob
      leaveType: 'sick',
      startDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
      numberOfDays: 1,
      reason: 'Medical appointment',
      status: 'pending',
      appliedBy: employeeUsers[1]._id,
    });

    // Approved leaves
    const approvedLeave1 = await Leave.create({
      employeeId: employees[2]._id, // Charlie
      leaveType: 'annual',
      startDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      endDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      numberOfDays: 3,
      reason: 'Vacation',
      status: 'approved',
      appliedBy: employeeUsers[2]._id,
      approvedBy: manager1User._id,
      approvedAt: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000),
    });

    // Rejected leave
    const rejectedLeave = await Leave.create({
      employeeId: employees[3]._id, // Diana
      leaveType: 'casual',
      startDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
      endDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
      numberOfDays: 1,
      reason: 'Personal',
      status: 'rejected',
      appliedBy: employeeUsers[3]._id,
      approvedBy: manager1User._id,
      approvedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
      rejectionReason: 'High workload period',
    });
    console.log('Created Leave Requests');

    // ========== CREATE ATTENDANCE RECORDS (LAST 30 DAYS) ==========
    for (let i = 0; i < 30; i++) {
      const attendanceDate = new Date(today);
      attendanceDate.setDate(attendanceDate.getDate() - i);
      const dayOfWeek = attendanceDate.getDay();

      // Skip weekends for most employees
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      for (let j = 0; j < employees.length; j++) {
        // Skip some random days (absent)
        if (Math.random() < 0.1) continue; // 10% chance of absence

        const checkInHour = j < 5 ? 9 : j < 8 ? 8 + Math.floor(Math.random() * 2) : 14; // Different times for different teams
        const checkInMinute = Math.floor(Math.random() * 30); // 0-29 minutes
        const checkIn = new Date(attendanceDate);
        checkIn.setHours(checkInHour, checkInMinute, 0, 0);

        const checkOutHour = j < 5 ? 18 : j < 8 ? 17 + Math.floor(Math.random() * 2) : 23;
        const checkOutMinute = Math.floor(Math.random() * 30);
        const checkOut = new Date(attendanceDate);
        checkOut.setHours(checkOutHour, checkOutMinute, 0, 0);

        const workingHours = Math.floor((checkOut.getTime() - checkIn.getTime()) / (1000 * 60));

        await Attendance.create({
          employeeId: employees[j]._id,
          date: attendanceDate,
          checkIn: checkIn,
          checkOut: checkOut,
          workingHours: workingHours,
          isLate: checkInMinute > 15,
          isEarlyExit: workingHours < 480,
          status: workingHours >= 480 ? 'present' : workingHours >= 240 ? 'half_day' : 'present',
          shiftId: shifts[0]._id,
        });
      }
    }
    console.log('Created Attendance Records for last 30 days');

    // ========== CREATE WORK REPORTS ==========
    // Create work reports for last 14 days
    for (let i = 0; i < 14; i++) {
      const reportDate = new Date(today);
      reportDate.setDate(reportDate.getDate() - i);
      const dayOfWeek = reportDate.getDay();

      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      for (let j = 0; j < employees.length; j++) {
        // 80% chance of submitting report
        if (Math.random() < 0.2) continue;

        const tasks: Array<{
          title: string;
          category: 'development' | 'testing' | 'meeting' | 'support' | 'learning' | 'documentation' | 'other';
          description: string;
          timeSpent: number;
          status: 'completed' | 'in_progress' | 'blocked';
          blockerReason?: string;
        }> = [
          {
            title: 'Feature Development',
            category: 'development',
            description: 'Implemented new feature',
            timeSpent: 240 + Math.floor(Math.random() * 120),
            status: 'completed',
          },
          {
            title: 'Code Review',
            category: 'development',
            description: 'Reviewed team member PRs',
            timeSpent: 60 + Math.floor(Math.random() * 60),
            status: 'completed',
          },
          {
            title: 'Team Meeting',
            category: 'meeting',
            description: 'Daily standup and planning',
            timeSpent: 30 + Math.floor(Math.random() * 30),
            status: 'completed',
          },
        ];

        // Add a blocked task sometimes
        if (Math.random() < 0.3) {
          tasks.push({
            title: 'Blocked Task',
            category: 'development',
            description: 'Waiting for dependency',
            timeSpent: 60,
            status: 'blocked',
            blockerReason: 'Waiting for API response',
          });
        }

        const totalWorkHours = tasks.reduce((sum, task) => sum + task.timeSpent, 0);
        const taskCompletionCount = tasks.filter(t => t.status === 'completed').length;
        const blockedTasksCount = tasks.filter(t => (t.status as string) === 'blocked').length;

        const report = await WorkReport.create({
          employeeId: employees[j]._id,
          reportDate: reportDate,
          frequency: 'daily' as const,
          status: Math.random() < 0.7 ? 'submitted' : 'draft' as any,
          employeeName: employees[j].name,
          employeeRole: employees[j].role,
          managerId: employees[j].managerId,
          tasks: tasks,
          keyAchievements: 'Completed major features and fixed bugs',
          challengesFaced: 'Faced some technical challenges but resolved them',
          supportNeeded: 'Need access to production environment',
          selfProductivityRating: 3 + Math.floor(Math.random() * 3), // 3-5
          totalWorkHours: totalWorkHours,
          taskCompletionCount: taskCompletionCount,
          blockedTasksCount: blockedTasksCount,
          productivityScore: 70 + Math.floor(Math.random() * 30), // 70-100
          submittedAt: Math.random() < 0.7 ? reportDate : undefined,
        });

        // Add manager review for some submitted reports
        if (report.status === 'submitted' && Math.random() < 0.6) {
          report.managerReview = {
            reviewedBy: manager1User._id,
            reviewedAt: new Date(reportDate.getTime() + 24 * 60 * 60 * 1000),
            taskComments: [
              { taskIndex: 0, comment: 'Great work!' },
            ],
            overallFeedback: 'Good progress, keep it up',
            managerProductivityRating: 4,
            flag: Math.random() < 0.1 ? 'excellent' : null as any,
            approved: Math.random() < 0.8,
            returnedReason: Math.random() < 0.2 ? 'Need more details' : undefined,
          };
          report.status = report.managerReview.approved ? 'approved' : 'returned' as any;
          if (report.managerReview.approved) {
            report.approvedAt = report.managerReview.reviewedAt;
          }
          await report.save();
        }
      }
    }
    console.log('Created Work Reports');

    // ========== CREATE APPRAISAL CYCLES ==========
    // Closed cycle
    const closedCycle = await AppraisalCycle.create({
      name: 'H2 2024',
      startDate: new Date('2024-07-01'),
      endDate: new Date('2024-12-31'),
      status: 'closed',
      competencies: [
        { name: 'Communication', type: 'rating', maxRating: 5 },
        { name: 'Technical Skills', type: 'rating', maxRating: 5 },
        { name: 'Teamwork', type: 'rating', maxRating: 5 },
        { name: 'Ownership', type: 'rating', maxRating: 5 },
        { name: 'Delivery', type: 'rating', maxRating: 5 },
        { name: 'Comments', type: 'text' },
      ],
      createdBy: hrUser._id,
    });

    // Open for manager review cycle
    const managerReviewCycle = await AppraisalCycle.create({
      name: 'H1 2025',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-06-30'),
      status: 'open_manager_review',
      competencies: [
        { name: 'Communication', type: 'rating', maxRating: 5 },
        { name: 'Technical Skills', type: 'rating', maxRating: 5 },
        { name: 'Teamwork', type: 'rating', maxRating: 5 },
        { name: 'Ownership', type: 'rating', maxRating: 5 },
        { name: 'Delivery', type: 'rating', maxRating: 5 },
        { name: 'Comments', type: 'text' },
      ],
      createdBy: hrUser._id,
    });

    // Open for self review cycle
    const selfReviewCycle = await AppraisalCycle.create({
      name: 'Q1 2025',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-03-31'),
      status: 'open_self_review',
      competencies: [
        { name: 'Communication', type: 'rating', maxRating: 5 },
        { name: 'Problem Solving', type: 'rating', maxRating: 5 },
        { name: 'Innovation', type: 'rating', maxRating: 5 },
        { name: 'Comments', type: 'text' },
      ],
      createdBy: hrUser._id,
    });

    // Draft cycle
    const draftCycle = await AppraisalCycle.create({
      name: 'Q2 2025',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-06-30'),
      status: 'draft',
      competencies: [
        { name: 'Communication', type: 'rating', maxRating: 5 },
        { name: 'Technical Skills', type: 'rating', maxRating: 5 },
        { name: 'Comments', type: 'text' },
      ],
      createdBy: hrUser._id,
    });
    console.log('Created Appraisal Cycles');

    // ========== CREATE SELF REVIEWS ==========
    // Self reviews for closed cycle
    for (let i = 0; i < 5; i++) {
      await SelfReview.create({
        cycleId: closedCycle._id,
        employeeId: employees[i]._id,
        ratings: {
          Communication: 4,
          'Technical Skills': 5,
          Teamwork: 4,
          Ownership: 5,
          Delivery: 4,
          Comments: 'I performed well this cycle',
        },
        comments: 'Overall good performance',
        status: 'submitted',
        submittedAt: new Date('2024-12-15'),
      });
    }

    // Self reviews for manager review cycle
    for (let i = 0; i < 8; i++) {
      await SelfReview.create({
        cycleId: managerReviewCycle._id,
        employeeId: employees[i]._id,
        ratings: {
          Communication: 3 + Math.floor(Math.random() * 3),
          'Technical Skills': 3 + Math.floor(Math.random() * 3),
          Teamwork: 3 + Math.floor(Math.random() * 3),
          Ownership: 3 + Math.floor(Math.random() * 3),
          Delivery: 3 + Math.floor(Math.random() * 3),
          Comments: 'Self assessment comments',
        },
        comments: 'I believe I performed well',
        status: 'submitted',
        submittedAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
      });
    }

    // Self reviews for self review cycle (some submitted, some draft)
    for (let i = 0; i < 10; i++) {
      const isSubmitted = Math.random() < 0.6;
      await SelfReview.create({
        cycleId: selfReviewCycle._id,
        employeeId: employees[i]._id,
        ratings: {
          Communication: 3 + Math.floor(Math.random() * 3),
          'Problem Solving': 3 + Math.floor(Math.random() * 3),
          Innovation: 3 + Math.floor(Math.random() * 3),
          Comments: 'Working on improving',
        },
        comments: 'Draft review',
        status: isSubmitted ? 'submitted' : 'draft',
        submittedAt: isSubmitted ? new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000) : undefined,
      });
    }
    console.log('Created Self Reviews');

    // ========== CREATE MANAGER REVIEWS ==========
    // Manager reviews for closed cycle
    for (let i = 0; i < 5; i++) {
      await ManagerReview.create({
        cycleId: closedCycle._id,
        employeeId: employees[i]._id,
        managerId: manager1._id,
        ratings: {
          Communication: 4,
          'Technical Skills': 5,
          Teamwork: 4,
          Ownership: 5,
          Delivery: 4,
        },
        managerComments: 'Excellent performance throughout the cycle',
        finalRating: '4.4',
        status: 'submitted',
        submittedAt: new Date('2024-12-20'),
      });
    }

    // Manager reviews for manager review cycle (some submitted, some draft)
    for (let i = 0; i < 5; i++) {
      const isSubmitted = Math.random() < 0.7;
      await ManagerReview.create({
        cycleId: managerReviewCycle._id,
        employeeId: employees[i]._id,
        managerId: manager1._id,
        ratings: {
          Communication: 3 + Math.floor(Math.random() * 3),
          'Technical Skills': 3 + Math.floor(Math.random() * 3),
          Teamwork: 3 + Math.floor(Math.random() * 3),
          Ownership: 3 + Math.floor(Math.random() * 3),
          Delivery: 3 + Math.floor(Math.random() * 3),
        },
        managerComments: 'Good progress, areas for improvement',
        finalRating: (3.5 + Math.random() * 1.5).toFixed(1),
        status: isSubmitted ? 'submitted' : 'draft',
        submittedAt: isSubmitted ? new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000) : undefined,
      });
    }
    console.log('Created Manager Reviews');

    // ========== CREATE NOTIFICATIONS ==========
    // Notifications for employees about appraisal cycles
    for (let i = 0; i < employees.length; i++) {
      await Notification.create({
        userId: employeeUsers[i]._id,
        type: 'cycle_started',
        title: 'New Appraisal Cycle Started',
        message: `Q1 2025 appraisal cycle has started. Please submit your self-review.`,
        link: `/dashboard/employee/appraisals`,
        isRead: Math.random() < 0.5,
        relatedId: selfReviewCycle._id,
      });

      if (i < 8) {
        await Notification.create({
          userId: employeeUsers[i]._id,
          type: 'review_pending',
          title: 'Manager Review Pending',
          message: 'Your manager is reviewing your performance for H1 2025 cycle',
          link: `/dashboard/employee/appraisals`,
          isRead: false,
          relatedId: managerReviewCycle._id,
        });
      }
    }

    // Notifications for managers
    await Notification.create({
      userId: manager1User._id,
      type: 'review_pending',
      title: 'Team Reviews Pending',
      message: 'You have 5 team members waiting for review',
      link: `/dashboard/manager/reviews`,
      isRead: false,
    });
    console.log('Created Notifications');

    // ========== CREATE SHIFT SWAPS ==========
    // Pending swap request
    const swapDate1 = new Date(today);
    swapDate1.setDate(swapDate1.getDate() + 10);
    const swapDate2 = new Date(today);
    swapDate2.setDate(swapDate2.getDate() + 17);

    await ShiftSwap.create({
      requesterId: employees[0]._id, // Alice
      requesteeId: employees[1]._id, // Bob
      requesterDate: swapDate1,
      requesteeDate: swapDate2,
      requesterShiftId: shifts[0]._id,
      requesteeShiftId: shifts[0]._id,
      reason: 'Need to attend family event',
      status: 'pending',
    });

    // Approved swap
    const approvedSwapDate1 = new Date(today);
    approvedSwapDate1.setDate(approvedSwapDate1.getDate() - 5);
    const approvedSwapDate2 = new Date(today);
    approvedSwapDate2.setDate(approvedSwapDate2.getDate() + 2);

    await ShiftSwap.create({
      requesterId: employees[2]._id, // Charlie
      requesteeId: employees[3]._id, // Diana
      requesterDate: approvedSwapDate1,
      requesteeDate: approvedSwapDate2,
      requesterShiftId: shifts[0]._id,
      requesteeShiftId: shifts[0]._id,
      reason: 'Medical appointment',
      status: 'approved',
      reviewedBy: manager1User._id,
      reviewedAt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
    });
    console.log('Created Shift Swaps');

    // ========== SUMMARY ==========
    console.log('\n========================================');
    console.log('SEED DATA CREATED SUCCESSFULLY!');
    console.log('========================================\n');
    console.log('SUMMARY:');
    console.log(`- 1 Super Admin`);
    console.log(`- 1 HR User`);
    console.log(`- 3 Managers`);
    console.log(`- ${employees.length} Employees`);
    console.log(`- ${shifts.length} Shifts`);
    console.log(`- Multiple Shift Assignments`);
    console.log(`- Rosters for current month (${daysInMonth} days)`);
    console.log(`- Leave Balances for all employees`);
    console.log(`- Leave Requests (pending, approved, rejected)`);
    console.log(`- Attendance Records (last 30 days)`);
    console.log(`- Work Reports (last 14 days)`);
    console.log(`- 4 Appraisal Cycles (draft, open_self_review, open_manager_review, closed)`);
    console.log(`- Self Reviews`);
    console.log(`- Manager Reviews`);
    console.log(`- Notifications`);
    console.log(`- Shift Swaps`);
    console.log('\n========================================');
    console.log('DEFAULT LOGIN CREDENTIALS:');
    console.log('========================================');
    console.log('Super Admin: admin@company.com / password123');
    console.log('HR: hr@company.com / password123');
    console.log('Manager 1: manager@company.com / password123');
    console.log('Manager 2: manager2@company.com / password123');
    console.log('Manager 3: manager3@company.com / password123');
    console.log('\nEmployees:');
    empData.forEach((emp, idx) => {
      console.log(`${emp.name}: ${emp.email} / password123`);
    });
    console.log('\n========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
