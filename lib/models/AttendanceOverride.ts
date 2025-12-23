import mongoose, { Schema, Document, Model } from 'mongoose';

export type OverrideType = 'temporary' | 'permanent' | 'emergency';
export type OverrideStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface IAttendanceOverride extends Document {
  employeeId: mongoose.Types.ObjectId;
  overrideType: OverrideType;
  status: OverrideStatus;
  
  // Override details
  reason: string; // Required reason for override
  description?: string; // Additional details
  
  // Duration (for temporary overrides)
  validFrom: Date;
  validTo: Date;
  
  // Approval workflow
  requestedBy: mongoose.Types.ObjectId; // Employee or HR who requested
  approvedBy?: mongoose.Types.ObjectId; // HR/Admin who approved
  rejectedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  approvedAt?: Date;
  rejectedAt?: Date;
  
  // Policy override
  policyId?: mongoose.Types.ObjectId; // Policy being overridden
  allowRemoteAttendance: boolean; // Whether remote attendance is allowed
  
  // Usage tracking
  timesUsed: number; // How many times this override was used
  lastUsedAt?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceOverrideSchema = new Schema<IAttendanceOverride>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    overrideType: {
      type: String,
      enum: ['temporary', 'permanent', 'emergency'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending',
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    validFrom: {
      type: Date,
      required: true,
      index: true,
    },
    validTo: {
      type: Date,
      required: true,
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    policyId: {
      type: Schema.Types.ObjectId,
      ref: 'WiFiPolicy',
      default: null,
    },
    allowRemoteAttendance: {
      type: Boolean,
      default: true,
    },
    timesUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
AttendanceOverrideSchema.index({ employeeId: 1, status: 1, validFrom: 1, validTo: 1 });
AttendanceOverrideSchema.index({ status: 1, validTo: 1 }); // For finding expired overrides
AttendanceOverrideSchema.index({ requestedBy: 1, createdAt: -1 });

// Compound index for active overrides lookup
AttendanceOverrideSchema.index({
  employeeId: 1,
  status: 'approved',
  validFrom: 1,
  validTo: 1,
});

const AttendanceOverride: Model<IAttendanceOverride> =
  mongoose.models.AttendanceOverride ||
  mongoose.model<IAttendanceOverride>('AttendanceOverride', AttendanceOverrideSchema);

export default AttendanceOverride;

