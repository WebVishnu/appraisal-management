import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPayslip extends Document {
  payrollId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  
  // Payroll period
  payrollMonth: number;
  payrollYear: number;
  
  // Employee details (snapshot)
  employeeName: string;
  employeeIdString: string; // Employee ID string (e.g., "EMP001")
  designation: string;
  
  // Salary breakdown
  grossMonthlySalary: number;
  payableDays: number;
  perDaySalary: number;
  grossPayable: number;
  
  // Deductions breakdown
  deductions: {
    unpaidLeave: number;
    halfDay: number;
    latePenalty?: number;
    total: number;
  };
  
  netPayable: number;
  
  // Attendance summary
  attendanceSummary: {
    totalWorkingDays: number;
    presentDays: number;
    absentDays: number;
    halfDays: number;
    paidLeaveDays: number;
    unpaidLeaveDays: number;
  };
  
  // PDF file reference
  pdfUrl?: string;
  pdfGeneratedAt: Date;
  
  // Versioning (for regenerated payslips)
  version: number;
  previousVersionId?: mongoose.Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const PayslipSchema = new Schema<IPayslip>(
  {
    payrollId: {
      type: Schema.Types.ObjectId,
      ref: 'Payroll',
      required: true,
      unique: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    payrollMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    payrollYear: {
      type: Number,
      required: true,
    },
    employeeName: {
      type: String,
      required: true,
    },
    employeeIdString: {
      type: String,
      required: true,
      field: 'employeeIdString', // Explicit field name
    },
    designation: {
      type: String,
      required: true,
    },
    grossMonthlySalary: {
      type: Number,
      required: true,
    },
    payableDays: {
      type: Number,
      required: true,
    },
    perDaySalary: {
      type: Number,
      required: true,
    },
    grossPayable: {
      type: Number,
      required: true,
    },
    deductions: {
      unpaidLeave: {
        type: Number,
        default: 0,
      },
      halfDay: {
        type: Number,
        default: 0,
      },
      latePenalty: {
        type: Number,
        default: 0,
      },
      total: {
        type: Number,
        default: 0,
      },
    },
    netPayable: {
      type: Number,
      required: true,
    },
    attendanceSummary: {
      totalWorkingDays: {
        type: Number,
        required: true,
      },
      presentDays: {
        type: Number,
        required: true,
      },
      absentDays: {
        type: Number,
        required: true,
      },
      halfDays: {
        type: Number,
        required: true,
      },
      paidLeaveDays: {
        type: Number,
        required: true,
      },
      unpaidLeaveDays: {
        type: Number,
        required: true,
      },
    },
    pdfUrl: {
      type: String,
    },
    pdfGeneratedAt: {
      type: Date,
      required: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    previousVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'Payslip',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
PayslipSchema.index({ employeeId: 1, payrollYear: 1, payrollMonth: 1 });
PayslipSchema.index({ payrollYear: 1, payrollMonth: 1 });

const Payslip: Model<IPayslip> = mongoose.models.Payslip || mongoose.model<IPayslip>('Payslip', PayslipSchema);

export default Payslip;

