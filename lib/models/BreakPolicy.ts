import mongoose, { Schema, Document, Model } from 'mongoose';

export type PolicyScope = 'global' | 'department' | 'role' | 'shift' | 'employee';

export interface IBreakPolicy extends Document {
  name: string;
  description?: string;
  scope: PolicyScope;
  scopeIds: mongoose.Types.ObjectId[]; // Department IDs, Role IDs, Shift IDs, or Employee IDs
  allowBreaks: boolean;
  maxBreaksPerDay?: number;
  maxTotalBreakDuration?: number; // in minutes
  maxDurationPerBreak?: number; // in minutes
  allowedBreakTypes: string[]; // ['lunch', 'tea', 'personal', 'custom']
  mandatoryBreaks: string[]; // Breaks that must be taken
  minWorkingHoursBeforeFirstBreak?: number; // in hours
  gracePeriod?: number; // in minutes, allowed overrun
  paidBreaks: string[]; // Which break types are paid
  deductBreakTime: boolean; // Deduct break time from working hours
  autoFlagExcessiveBreaks: boolean;
  allowBreakOverrun: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BreakPolicySchema = new Schema<IBreakPolicy>(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      default: null,
    },
    scope: {
      type: String,
      enum: ['global', 'department', 'role', 'shift', 'employee'],
      required: true,
      index: true,
    },
    scopeIds: {
      type: [Schema.Types.ObjectId],
      default: [],
      index: true,
    },
    allowBreaks: {
      type: Boolean,
      default: true,
    },
    maxBreaksPerDay: {
      type: Number,
      default: null,
    },
    maxTotalBreakDuration: {
      type: Number,
      default: null, // in minutes
    },
    maxDurationPerBreak: {
      type: Number,
      default: null, // in minutes
    },
    allowedBreakTypes: {
      type: [String],
      default: ['lunch', 'tea', 'personal'],
    },
    mandatoryBreaks: {
      type: [String],
      default: [],
    },
    minWorkingHoursBeforeFirstBreak: {
      type: Number,
      default: null, // in hours
    },
    gracePeriod: {
      type: Number,
      default: 5, // minutes
    },
    paidBreaks: {
      type: [String],
      default: ['lunch'],
    },
    deductBreakTime: {
      type: Boolean,
      default: true,
    },
    autoFlagExcessiveBreaks: {
      type: Boolean,
      default: true,
    },
    allowBreakOverrun: {
      type: Boolean,
      default: false,
    },
    effectiveFrom: {
      type: Date,
      required: true,
      index: true,
    },
    effectiveTo: {
      type: Date,
      default: null,
      index: true,
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

// Indexes
BreakPolicySchema.index({ scope: 1, isActive: 1, effectiveFrom: 1, effectiveTo: 1 });
BreakPolicySchema.index({ scopeIds: 1 });

// Method to check if policy is effective for a given date
BreakPolicySchema.methods.isEffective = function (date: Date): boolean {
  if (!this.isActive) return false;
  if (date < this.effectiveFrom) return false;
  if (this.effectiveTo && date > this.effectiveTo) return false;
  return true;
};

// Method to check if policy applies to employee
BreakPolicySchema.methods.appliesTo = function (
  employeeId: mongoose.Types.ObjectId,
  departmentId?: mongoose.Types.ObjectId,
  roleId?: string,
  shiftId?: mongoose.Types.ObjectId
): boolean {
  if (this.scope === 'global') return true;
  if (this.scope === 'employee' && this.scopeIds.includes(employeeId)) return true;
  if (this.scope === 'department' && departmentId && this.scopeIds.includes(departmentId)) return true;
  if (this.scope === 'role' && roleId && this.scopeIds.some((id: any) => id.toString() === roleId)) return true;
  if (this.scope === 'shift' && shiftId && this.scopeIds.includes(shiftId)) return true;
  return false;
};

const BreakPolicy: Model<IBreakPolicy> =
  mongoose.models.BreakPolicy || mongoose.model<IBreakPolicy>('BreakPolicy', BreakPolicySchema);

export default BreakPolicy;

