import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Payroll from '@/lib/models/Payroll';
import Employee from '@/lib/models/Employee';
import SalaryStructure from '@/lib/models/SalaryStructure';
import mongoose from 'mongoose';

// GET - Get payroll dashboard statistics
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    const currentDate = new Date();
    const currentMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    const currentYear = year ? parseInt(year) : currentDate.getFullYear();

    // Get total active employees
    const totalEmployees = await Employee.countDocuments({ isActive: true });

    // Get employees with salary structures
    const employeesWithStructure = await SalaryStructure.countDocuments({
      isActive: true,
      $or: [{ employeeId: { $ne: null } }, { role: { $ne: null } }],
    });

    // Get payroll statistics for the month
    const payrolls = await Payroll.find({
      payrollYear: currentYear,
      payrollMonth: currentMonth,
    });

    const processedCount = payrolls.filter(p => p.status === 'processed' || p.status === 'locked').length;
    const lockedCount = payrolls.filter(p => p.status === 'locked').length;
    const draftCount = payrolls.filter(p => p.status === 'draft').length;

    const totalPayrollCost = payrolls
      .filter(p => p.status === 'processed' || p.status === 'locked')
      .reduce((sum, p) => sum + p.netPayable, 0);

    // Get employees pending payroll (active but no payroll record)
    const processedEmployeeIds = payrolls.map(p => p.employeeId.toString());
    const pendingEmployees = await Employee.find({
      isActive: true,
      _id: { $nin: processedEmployeeIds.map(id => new mongoose.Types.ObjectId(id)) },
    }).select('name employeeId email').limit(10);

    // Get payrolls with anomalies
    const payrollsWithAnomalies = payrolls.filter(p => p.anomalies && p.anomalies.length > 0).length;

    return NextResponse.json({
      summary: {
        totalEmployees,
        employeesWithStructure,
        processedCount,
        lockedCount,
        draftCount,
        pendingCount: pendingEmployees.length,
        totalPayrollCost,
        payrollsWithAnomalies,
      },
      pendingEmployees,
      currentMonth,
      currentYear,
    });
  } catch (error) {
    console.error('Error fetching payroll dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

