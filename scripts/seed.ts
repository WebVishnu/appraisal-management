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
    await Promise.all([
      User.deleteMany({}),
      Employee.deleteMany({}),
      AppraisalCycle.deleteMany({}),
      Shift.deleteMany({}),
      ShiftAssignment.deleteMany({}),
      Roster.deleteMany({}),
      LeaveBalance.deleteMany({}),
      Leave.deleteMany({}),
      Attendance.deleteMany({}),
      WorkReport.deleteMany({}),
      SelfReview.deleteMany({}),
      ManagerReview.deleteMany({}),
      Notification.deleteMany({}),
      ShiftSwap.deleteMany({}),
    ]);

    const hashedPassword = await bcrypt.hash('password123', 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();

    // ================= SUPER ADMIN =================
    const superAdminEmployee = await Employee.create({
      employeeId: 'ADMIN001',
      name: 'Divya Shukla',
      email: 'divya.shukla@pioneer.com',
      role: 'CEO',
      isActive: true,
    });

    const superAdminUser = await User.create({
      email: 'divya.shukla@pioneer.com',
      password: hashedPassword,
      role: 'super_admin',
      employeeId: superAdminEmployee._id,
      isActive: true,
    });

    // ================= HR =================
    const hrEmployee = await Employee.create({
      employeeId: 'HR001',
      name: 'Nihalika',
      email: 'nihalika.hr@pioneer.com',
      role: 'HR Manager',
      isActive: true,
    });

    const hrUser = await User.create({
      email: 'nihalika.hr@pioneer.com',
      password: hashedPassword,
      role: 'hr',
      employeeId: hrEmployee._id,
      isActive: true,
    });

    // ================= MANAGERS =================
    const managerData = [
      { id: 'MGR001', name: 'Shailesh Vats', email: 'shailesh.vats@pioneer.com', role: 'GM / HR / Admin' },
      { id: 'MGR002', name: 'Punit Seth', email: 'punit.seth@pioneer.com', role: 'Manager' },
      { id: 'MGR003', name: 'Saurabh Yadav', email: 'saurabh.yadav@pioneer.com', role: 'Senior Producer' },
    ];

    const managers = [];
    const managerUsers = [];

    for (const m of managerData) {
      const emp = await Employee.create({
        employeeId: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        isActive: true,
      });

      const user = await User.create({
        email: m.email,
        password: hashedPassword,
        role: 'manager',
        employeeId: emp._id,
        isActive: true,
      });

      managers.push(emp);
      managerUsers.push(user);
    }

    // ================= EMPLOYEES =================
    const empData = [
      { id: 'EMP001', name: 'Manoj Chauhan', email: 'manoj.chauhan@pioneer.com', role: 'PSO', manager: managers[0] },
      { id: 'EMP002', name: 'Achal Kumar', email: 'achal.kumar@pioneer.com', role: 'PSO', manager: managers[0] },
      { id: 'EMP003', name: 'Kumar', email: 'kumar@pioneer.com', role: 'PSO', manager: managers[0] },
      { id: 'EMP004', name: 'Fiaz Ali', email: 'fiaz.ali@pioneer.com', role: 'Accounts & Admin', manager: managers[0] },
      { id: 'EMP005', name: 'Dinesh Chandra', email: 'dinesh.chandra@pioneer.com', role: 'Admin / Electrical', manager: managers[0] },

      { id: 'EMP006', name: 'Sapna', email: 'sapna.digital@pioneer.com', role: 'Digital Executive', manager: managers[1] },
      { id: 'EMP007', name: 'Ashish Rawat', email: 'ashish.rawat@pioneer.com', role: 'Technical', manager: managers[1] },
      { id: 'EMP008', name: 'Saurabh Pandey', email: 'saurabh.pandey@pioneer.com', role: 'PCR Panel Producer', manager: managers[1] },

      { id: 'EMP009', name: 'Shivam Dubey', email: 'shivam.dubey@pioneer.com', role: 'Anchor / Producer', manager: managers[2] },
      { id: 'EMP010', name: 'Anchal Srivastava', email: 'anchal.srivastava@pioneer.com', role: 'Anchor / Producer', manager: managers[2] },
      { id: 'EMP011', name: 'Priya', email: 'priya.anchor@pioneer.com', role: 'Anchor / Producer', manager: managers[2] },

      { id: 'EMP012', name: 'Adil Saifi', email: 'adil.saifi@pioneer.com', role: 'Software Developer', manager: managers[0] },
      { id: 'EMP013', name: 'Twinkle', email: 'twinkle.social@pioneer.com', role: 'Social Media Executive', manager: managers[1] },
      { id: 'EMP014', name: 'Deepak Sharma', email: 'deepak.sharma@pioneer.com', role: 'Cameraman', manager: managers[2] },
      { id: 'EMP015', name: 'Reeta Bisht', email: 'reeta.bisht@pioneer.com', role: 'Video Editor', manager: managers[2] },
    ];

    const employees = [];
    const employeeUsers = [];

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

    // ================= SHIFTS =================
    const shifts = await Shift.insertMany([
      {
        name: 'Morning Shift',
        shiftType: 'fixed',
        startTime: '09:00',
        endTime: '18:00',
        gracePeriod: 15,
        minimumWorkingHours: 480,
        breakDuration: 60,
        workingDays: ['monday','tuesday','wednesday','thursday','friday'],
        isNightShift: false,
        createdBy: hrUser._id,
        isActive: true,
      },
      {
        name: 'Evening Shift',
        shiftType: 'fixed',
        startTime: '14:00',
        endTime: '23:00',
        gracePeriod: 15,
        minimumWorkingHours: 480,
        breakDuration: 60,
        workingDays: ['monday','tuesday','wednesday','thursday','friday'],
        isNightShift: false,
        createdBy: hrUser._id,
        isActive: true,
      },
      {
        name: 'Night Shift',
        shiftType: 'fixed',
        startTime: '22:00',
        endTime: '06:00',
        gracePeriod: 15,
        minimumWorkingHours: 480,
        breakDuration: 60,
        workingDays: ['monday','tuesday','wednesday','thursday','friday'],
        isNightShift: true,
        createdBy: hrUser._id,
        isActive: true,
      },
    ]);

    // ================= BASIC LEAVE BALANCES =================
    for (const emp of employees) {
      await LeaveBalance.create({
        employeeId: emp._id,
        leaveType: 'paid',
        totalDays: 12,
        usedDays: 2,
        availableDays: 10,
        year,
        lastUpdatedBy: hrUser._id,
      });
    }

    console.log('✅ SEED DATA CREATED SUCCESSFULLY');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
