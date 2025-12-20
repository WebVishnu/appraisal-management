import mongoose, { Schema, Document, Model } from 'mongoose';

export type AuditAction =
  | 'salary_structure_created'
  | 'salary_structure_updated'
  | 'salary_structure_deactivated'
  | 'payroll_processed'
  | 'payroll_locked'
  | 'payroll_unlocked'
  | 'payslip_generated'
  | 'payslip_regenerated'
  | 'manual_adjustment';

export interface IPayrollAudit extends Document {
  action: AuditAction;
  
  // Target references
  salaryStructureId?: mongoose.Types.ObjectId;
  payrollId?: mongoose.Types.ObjectId;
  payslipId?: mongoose.Types.ObjectId;
  employeeId?: mongoose.Types.ObjectId;
  
  // Action details
  description: string;
  changes?: Record<string, any>; // Before/after values for updates
  reason?: string; // Reason for manual adjustments
  
  // Actor
  performedBy: mongoose.Types.ObjectId;
  performedAt: Date;
  
  // Metadata
  ipAddress?: string;
  userAgent?: string;
}

const PayrollAuditSchema = new Schema<IPayrollAudit>(
  {
    action: {
      type: String,
      enum: [
        'salary_structure_created',
        'salary_structure_updated',
        'salary_structure_deactivated',
        'payroll_processed',
        'payroll_locked',
        'payroll_unlocked',
        'payslip_generated',
        'payslip_regenerated',
        'manual_adjustment',
      ],
      required: true,
      index: true,
    },
    salaryStructureId: {
      type: Schema.Types.ObjectId,
      ref: 'SalaryStructure',
    },
    payrollId: {
      type: Schema.Types.ObjectId,
      ref: 'Payroll',
    },
    payslipId: {
      type: Schema.Types.ObjectId,
      ref: 'Payslip',
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    changes: {
      type: Schema.Types.Mixed,
    },
    reason: {
      type: String,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    performedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: false, // We use performedAt instead
  }
);

// Indexes for efficient queries
PayrollAuditSchema.index({ employeeId: 1, performedAt: -1 });
PayrollAuditSchema.index({ payrollId: 1, performedAt: -1 });
PayrollAuditSchema.index({ action: 1, performedAt: -1 });

const PayrollAudit: Model<IPayrollAudit> =
  mongoose.models.PayrollAudit || mongoose.model<IPayrollAudit>('PayrollAudit', PayrollAuditSchema);

export default PayrollAudit;

