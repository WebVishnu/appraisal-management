import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISalaryStructure extends Document {
  employeeId?: mongoose.Types.ObjectId; // If null, applies to role
  role?: string; // If employeeId is null, this role gets this structure
  salaryType: 'monthly_fixed';
  grossMonthlySalary: number;
  
  // Calculation rules
  workingDaysRule: 'shift_based' | 'calendar_days' | 'fixed_days';
  fixedWorkingDays?: number; // If workingDaysRule is 'fixed_days'
  
  // Leave rules
  paidLeaveTypes: string[]; // Leave types that don't deduct salary
  unpaidLeaveTypes: string[]; // Leave types that deduct salary
  halfDayDeductionRule: 'half_day' | 'proportional'; // How to handle half-days
  
  // Effective dates
  effectiveFrom: Date;
  effectiveTo?: Date; // null means currently active
  
  // Versioning
  version: number;
  previousVersionId?: mongoose.Types.ObjectId; // Link to previous version
  
  // Status
  isActive: boolean;
  
  // Audit
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SalaryStructureSchema = new Schema<ISalaryStructure>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },
    role: {
      type: String,
      default: null,
      index: true,
    },
    salaryType: {
      type: String,
      enum: ['monthly_fixed'],
      default: 'monthly_fixed',
      required: true,
    },
    grossMonthlySalary: {
      type: Number,
      required: true,
      min: 0,
    },
    workingDaysRule: {
      type: String,
      enum: ['shift_based', 'calendar_days', 'fixed_days'],
      default: 'shift_based',
      required: true,
    },
    fixedWorkingDays: {
      type: Number,
      min: 1,
      max: 31,
    },
    paidLeaveTypes: {
      type: [String],
      default: ['paid'],
    },
    unpaidLeaveTypes: {
      type: [String],
      default: ['unpaid'],
    },
    halfDayDeductionRule: {
      type: String,
      enum: ['half_day', 'proportional'],
      default: 'half_day',
    },
    effectiveFrom: {
      type: Date,
      required: true,
      index: true,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    previousVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'SalaryStructure',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
SalaryStructureSchema.index({ employeeId: 1, isActive: 1, effectiveFrom: -1 });
SalaryStructureSchema.index({ role: 1, isActive: 1, effectiveFrom: -1 });
SalaryStructureSchema.index({ effectiveFrom: 1, effectiveTo: 1 });

// Validation: Either employeeId or role must be set
SalaryStructureSchema.pre('validate', function (next) {
  if (!this.employeeId && !this.role) {
    return next(new Error('Either employeeId or role must be specified'));
  }
  if (this.employeeId && this.role) {
    return next(new Error('Cannot specify both employeeId and role'));
  }
  if (this.workingDaysRule === 'fixed_days' && !this.fixedWorkingDays) {
    return next(new Error('fixedWorkingDays is required when workingDaysRule is fixed_days'));
  }
  next();
});

const SalaryStructure: Model<ISalaryStructure> =
  mongoose.models.SalaryStructure || mongoose.model<ISalaryStructure>('SalaryStructure', SalaryStructureSchema);

export default SalaryStructure;

