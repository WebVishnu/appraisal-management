import mongoose, { Schema, Document, Model } from 'mongoose';

export type PayrollStatus = 'draft' | 'processed' | 'locked';

export interface IPayroll extends Document {
  employeeId: mongoose.Types.ObjectId;
  payrollMonth: number; // 1-12
  payrollYear: number;
  
  // Salary structure used
  salaryStructureId: mongoose.Types.ObjectId;
  grossMonthlySalary: number;
  
  // Attendance data (snapshot at processing time)
  totalWorkingDays: number; // Based on shift/calendar
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  lateArrivals: number;
  
  // Calculation results
  payableDays: number;
  perDaySalary: number;
  grossPayable: number;
  deductions: {
    unpaidLeave: number;
    halfDay: number;
    latePenalty?: number; // Optional late arrival penalty
    total: number;
  };
  netPayable: number;
  
  // Status and processing
  status: PayrollStatus;
  processedAt?: Date;
  processedBy?: mongoose.Types.ObjectId;
  lockedAt?: Date;
  lockedBy?: mongoose.Types.ObjectId;
  
  // Anomalies detected during processing
  anomalies: string[];
  
  // Payslip reference
  payslipGenerated: boolean;
  payslipGeneratedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const PayrollSchema = new Schema<IPayroll>(
  {
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
      index: true,
    },
    payrollYear: {
      type: Number,
      required: true,
      index: true,
    },
    salaryStructureId: {
      type: Schema.Types.ObjectId,
      ref: 'SalaryStructure',
      required: true,
    },
    grossMonthlySalary: {
      type: Number,
      required: true,
      min: 0,
    },
    totalWorkingDays: {
      type: Number,
      required: true,
      min: 0,
    },
    presentDays: {
      type: Number,
      required: true,
      min: 0,
    },
    absentDays: {
      type: Number,
      required: true,
      min: 0,
    },
    halfDays: {
      type: Number,
      required: true,
      min: 0,
    },
    paidLeaveDays: {
      type: Number,
      required: true,
      min: 0,
    },
    unpaidLeaveDays: {
      type: Number,
      required: true,
      min: 0,
    },
    lateArrivals: {
      type: Number,
      default: 0,
    },
    payableDays: {
      type: Number,
      required: true,
      min: 0,
    },
    perDaySalary: {
      type: Number,
      required: true,
      min: 0,
    },
    grossPayable: {
      type: Number,
      required: true,
      min: 0,
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
      min: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'processed', 'locked'],
      default: 'draft',
      required: true,
      index: true,
    },
    processedAt: {
      type: Date,
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    lockedAt: {
      type: Date,
    },
    lockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    anomalies: {
      type: [String],
      default: [],
    },
    payslipGenerated: {
      type: Boolean,
      default: false,
    },
    payslipGeneratedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
PayrollSchema.index({ employeeId: 1, payrollYear: 1, payrollMonth: 1 }, { unique: true });
PayrollSchema.index({ payrollYear: 1, payrollMonth: 1, status: 1 });
PayrollSchema.index({ status: 1, payrollYear: 1, payrollMonth: 1 });

// Prevent modification after locking
PayrollSchema.pre('save', function (next) {
  if (this.isModified() && this.status === 'locked' && !this.isNew) {
    return next(new Error('Cannot modify locked payroll'));
  }
  next();
});

const Payroll: Model<IPayroll> = mongoose.models.Payroll || mongoose.model<IPayroll>('Payroll', PayrollSchema);

export default Payroll;

