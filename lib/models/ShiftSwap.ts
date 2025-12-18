import mongoose, { Schema, Document, Model } from 'mongoose';

export type SwapStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface IShiftSwap extends Document {
  requesterId: mongoose.Types.ObjectId; // Employee requesting swap
  requesteeId: mongoose.Types.ObjectId; // Employee being asked to swap
  requesterDate: Date; // Date requester wants to swap
  requesteeDate: Date; // Date requestee would swap to
  requesterShiftId: mongoose.Types.ObjectId; // Shift on requester's date
  requesteeShiftId: mongoose.Types.ObjectId; // Shift on requestee's date
  reason: string; // Reason for swap request
  status: SwapStatus;
  reviewedBy?: mongoose.Types.ObjectId; // Manager who reviewed
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShiftSwapSchema = new Schema<IShiftSwap>(
  {
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    requesteeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    requesterDate: {
      type: Date,
      required: true,
    },
    requesteeDate: {
      type: Date,
      required: true,
    },
    requesterShiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
    },
    requesteeShiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
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
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
ShiftSwapSchema.index({ requesterId: 1, status: 1 });
ShiftSwapSchema.index({ requesteeId: 1, status: 1 });
ShiftSwapSchema.index({ status: 1, createdAt: -1 });

// Validation: dates must be different
ShiftSwapSchema.pre('validate', function (next) {
  if (this.requesterDate.getTime() === this.requesteeDate.getTime()) {
    return next(new Error('Requester and requestee dates must be different'));
  }
  next();
});

const ShiftSwap: Model<IShiftSwap> =
  mongoose.models.ShiftSwap || mongoose.model<IShiftSwap>('ShiftSwap', ShiftSwapSchema);

export default ShiftSwap;

