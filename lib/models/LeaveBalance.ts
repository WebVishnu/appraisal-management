import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILeaveBalance extends Document {
  employeeId: mongoose.Types.ObjectId;
  leaveType: 'paid' | 'unpaid' | 'sick' | 'casual' | 'annual';
  totalDays: number; // Total allocated days
  usedDays: number; // Days used
  availableDays: number; // Available days (calculated)
  year: number; // Year for which balance is tracked
  lastUpdatedBy?: mongoose.Types.ObjectId; // HR/Admin who last updated
  lastUpdatedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveBalanceSchema = new Schema<ILeaveBalance>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    leaveType: {
      type: String,
      enum: ['paid', 'unpaid', 'sick', 'casual', 'annual'],
      required: true,
    },
    totalDays: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    usedDays: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    availableDays: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastUpdatedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index - one balance per employee per leave type per year
LeaveBalanceSchema.index({ employeeId: 1, leaveType: 1, year: 1 }, { unique: true });

// Virtual for calculating available days (can be overridden by manual adjustment)
LeaveBalanceSchema.pre('save', function (next) {
  this.availableDays = this.totalDays - this.usedDays;
  next();
}); 

const LeaveBalance: Model<ILeaveBalance> =
  mongoose.models.LeaveBalance || mongoose.model<ILeaveBalance>('LeaveBalance', LeaveBalanceSchema);

export default LeaveBalance;