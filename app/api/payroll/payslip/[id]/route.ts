import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Payslip from '@/lib/models/Payslip';
import Payroll from '@/lib/models/Payroll';
import PayrollAudit from '@/lib/models/PayrollAudit';
import Employee from '@/lib/models/Employee';
import { jsPDF } from 'jspdf';
import mongoose from 'mongoose';

// GET - Get payslip
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    // id can be payrollId or payslipId
    let payslip = await Payslip.findOne({ payrollId: id });
    if (!payslip) {
      payslip = await Payslip.findById(id);
    }

    if (!payslip) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    // Role-based access control
    if (session.user.role === 'employee') {
      const employee = await Employee.findOne({ email: session.user.email });
      if (!employee || payslip.employeeId.toString() !== employee._id.toString()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    return NextResponse.json(payslip);
  } catch (error) {
    console.error('Error fetching payslip:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Generate payslip
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params; // payrollId
    await connectDB();

    const payroll = await Payroll.findById(id)
      .populate('employeeId', 'name employeeId role')
      .populate('salaryStructureId');

    if (!payroll) {
      return NextResponse.json({ error: 'Payroll not found' }, { status: 404 });
    }

    if (payroll.status !== 'processed' && payroll.status !== 'locked') {
      return NextResponse.json(
        { error: 'Payroll must be processed before generating payslip' },
        { status: 400 }
      );
    }

    // Get User ID
    let generatedByUserId: mongoose.Types.ObjectId;
    if (session.user.id) {
      generatedByUserId = new mongoose.Types.ObjectId(session.user.id);
    } else {
      const { default: User } = await import('@/lib/models/User');
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      generatedByUserId = user._id;
    }

    // Check if payslip already exists
    let existingPayslip = await Payslip.findOne({ payrollId: id });
    let version = 1;
    let previousVersionId = null;

    if (existingPayslip) {
      version = existingPayslip.version + 1;
      previousVersionId = existingPayslip._id;
    }

    const employee = payroll.employeeId as any;

    // Generate PDF
    const pdf = new jsPDF();
    
    // Payslip header
    pdf.setFontSize(20);
    pdf.text('PAYSLIP', 105, 20, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.text(`Period: ${getMonthName(payroll.payrollMonth)} ${payroll.payrollYear}`, 20, 35);
    
    // Employee details
    pdf.setFontSize(14);
    pdf.text('Employee Details', 20, 50);
    pdf.setFontSize(10);
    pdf.text(`Name: ${employee.name}`, 20, 60);
    pdf.text(`Employee ID: ${employee.employeeId}`, 20, 67);
    pdf.text(`Designation: ${employee.role}`, 20, 74);
    
    // Salary breakdown
    pdf.setFontSize(14);
    pdf.text('Salary Breakdown', 20, 90);
    pdf.setFontSize(10);
    
    let yPos = 100;
    pdf.text(`Gross Monthly Salary: ₹${payroll.grossMonthlySalary.toFixed(2)}`, 20, yPos);
    yPos += 7;
    pdf.text(`Total Working Days: ${payroll.totalWorkingDays}`, 20, yPos);
    yPos += 7;
    pdf.text(`Payable Days: ${payroll.payableDays.toFixed(2)}`, 20, yPos);
    yPos += 7;
    pdf.text(`Per Day Salary: ₹${payroll.perDaySalary.toFixed(2)}`, 20, yPos);
    yPos += 7;
    pdf.text(`Gross Payable: ₹${payroll.grossPayable.toFixed(2)}`, 20, yPos);
    
    // Deductions
    yPos += 10;
    pdf.setFontSize(14);
    pdf.text('Deductions', 20, yPos);
    yPos += 7;
    pdf.setFontSize(10);
    pdf.text(`Unpaid Leave: ₹${payroll.deductions.unpaidLeave.toFixed(2)}`, 20, yPos);
    yPos += 7;
    pdf.text(`Half Day: ₹${payroll.deductions.halfDay.toFixed(2)}`, 20, yPos);
    if (payroll.deductions.latePenalty && payroll.deductions.latePenalty > 0) {
      yPos += 7;
      pdf.text(`Late Penalty: ₹${payroll.deductions.latePenalty.toFixed(2)}`, 20, yPos);
    }
    yPos += 7;
    pdf.text(`Total Deductions: ₹${payroll.deductions.total.toFixed(2)}`, 20, yPos);
    
    // Net Payable
    yPos += 10;
    pdf.setFontSize(16);
    pdf.text(`Net Payable: ₹${payroll.netPayable.toFixed(2)}`, 20, yPos, { align: 'left' });
    
    // Attendance Summary
    yPos += 15;
    pdf.setFontSize(14);
    pdf.text('Attendance Summary', 20, yPos);
    yPos += 7;
    pdf.setFontSize(10);
    pdf.text(`Present Days: ${payroll.presentDays}`, 20, yPos);
    yPos += 7;
    pdf.text(`Absent Days: ${payroll.absentDays}`, 20, yPos);
    yPos += 7;
    pdf.text(`Half Days: ${payroll.halfDays}`, 20, yPos);
    yPos += 7;
    pdf.text(`Paid Leave Days: ${payroll.paidLeaveDays}`, 20, yPos);
    yPos += 7;
    pdf.text(`Unpaid Leave Days: ${payroll.unpaidLeaveDays}`, 20, yPos);
    
    // Footer
    pdf.setFontSize(8);
    pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 280);
    pdf.text(`Version: ${version}`, 20, 287);

    // Generate PDF as base64
    const pdfOutput = pdf.output('datauristring');
    const pdfDataUrl = pdfOutput;

    // Create or update payslip record
    const payslipData = {
      payrollId: payroll._id,
      employeeId: employee._id,
      payrollMonth: payroll.payrollMonth,
      payrollYear: payroll.payrollYear,
      employeeName: employee.name,
      employeeIdString: employee.employeeId,
      designation: employee.role,
      grossMonthlySalary: payroll.grossMonthlySalary,
      payableDays: payroll.payableDays,
      perDaySalary: payroll.perDaySalary,
      grossPayable: payroll.grossPayable,
      deductions: payroll.deductions,
      netPayable: payroll.netPayable,
      attendanceSummary: {
        totalWorkingDays: payroll.totalWorkingDays,
        presentDays: payroll.presentDays,
        absentDays: payroll.absentDays,
        halfDays: payroll.halfDays,
        paidLeaveDays: payroll.paidLeaveDays,
        unpaidLeaveDays: payroll.unpaidLeaveDays,
      },
      pdfUrl: pdfDataUrl,
      pdfGeneratedAt: new Date(),
      version,
      previousVersionId,
    };

    if (existingPayslip) {
      Object.assign(existingPayslip, payslipData);
      await existingPayslip.save();
    } else {
      const newPayslip = new Payslip(payslipData);
      await newPayslip.save();
      existingPayslip = newPayslip;
    }

    // Update payroll record
    payroll.payslipGenerated = true;
    payroll.payslipGeneratedAt = new Date();
    await payroll.save();

    // Create audit log
    await PayrollAudit.create({
      action: existingPayslip ? 'payslip_regenerated' : 'payslip_generated',
      payrollId: payroll._id,
      payslipId: existingPayslip._id,
      employeeId: employee._id,
      description: `${existingPayslip ? 'Regenerated' : 'Generated'} payslip for ${getMonthName(payroll.payrollMonth)} ${payroll.payrollYear}`,
      performedBy: generatedByUserId,
      performedAt: new Date(),
    });

    return NextResponse.json(existingPayslip);
  } catch (error) {
    console.error('Error generating payslip:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return months[month - 1];
}

