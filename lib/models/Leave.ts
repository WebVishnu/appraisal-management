import mongoose, { Schema, Document, Model } from 'mongoose';

export type LeaveType = 'paid' | 'unpaid' | 'sick' | 'casual' | 'annual';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ILeave extends Document {
  employeeId: mongoose.Types.ObjectId;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  numberOfDays: number;
  reason: string;
  status: LeaveStatus;
  appliedBy: mongoose.Types.ObjectId; // Employee who applied
  approvedBy?: mongoose.Types.ObjectId; // Manager who approved/rejected
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveSchema = new Schema<ILeave>(
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
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    numberOfDays: {
      type: Number,
      required: true,
      min: 0.5, // Half day support
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    appliedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
LeaveSchema.index({ employeeId: 1, startDate: -1 });
LeaveSchema.index({ status: 1, startDate: -1 });
LeaveSchema.index({ appliedBy: 1, status: 1 });

const Leave: Model<ILeave> = mongoose.models.Leave || mongoose.model<ILeave>('Leave', LeaveSchema);

export default Leave;

