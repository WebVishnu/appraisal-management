import mongoose, { Schema, Document, Model } from 'mongoose';

export type BreakType = 'lunch' | 'tea' | 'personal' | 'custom' | 'emergency';
export type BreakStatus = 'active' | 'completed' | 'auto_completed' | 'cancelled';

export interface IBreakSession extends Document {
  attendanceId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  breakType: BreakType;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in minutes, calculated
  status: BreakStatus;
  isPaid: boolean;
  policyId?: mongoose.Types.ObjectId;
  violationFlags: {
    exceededDuration?: boolean;
    exceededDailyLimit?: boolean;
    policyViolation?: boolean;
    reason?: string;
  };
  notes?: string;
  correctedBy?: mongoose.Types.ObjectId;
  correctedAt?: Date;
  correctionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BreakSessionSchema = new Schema<IBreakSession>(
  {
    attendanceId: {
      type: Schema.Types.ObjectId,
      ref: 'Attendance',
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    breakType: {
      type: String,
      enum: ['lunch', 'tea', 'personal', 'custom', 'emergency'],
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number,
      default: null, // in minutes
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'auto_completed', 'cancelled'],
      default: 'active',
      index: true,
    },
    isPaid: {
      type: Boolean,
      default: true,
    },
    policyId: {
      type: Schema.Types.ObjectId,
      ref: 'BreakPolicy',
      default: null,
    },
    violationFlags: {
      exceededDuration: {
        type: Boolean,
        default: false,
      },
      exceededDailyLimit: {
        type: Boolean,
        default: false,
      },
      policyViolation: {
        type: Boolean,
        default: false,
      },
      reason: {
        type: String,
        default: null,
      },
    },
    notes: {
      type: String,
      default: null,
    },
    correctedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    correctedAt: {
      type: Date,
      default: null,
    },
    correctionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
BreakSessionSchema.index({ attendanceId: 1, status: 1 });
BreakSessionSchema.index({ employeeId: 1, startTime: -1 });
BreakSessionSchema.index({ startTime: 1, endTime: 1 });

// Virtual for calculating duration if not set
BreakSessionSchema.virtual('calculatedDuration').get(function () {
  if (this.endTime && this.startTime) {
    return Math.floor((this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60));
  }
  return null;
});

// Pre-save hook to calculate duration
BreakSessionSchema.pre('save', function (next) {
  if (this.endTime && this.startTime && !this.duration) {
    this.duration = Math.floor((this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60));
  }
  next();
});

const BreakSession: Model<IBreakSession> =
  mongoose.models.BreakSession ||
  mongoose.model<IBreakSession>('BreakSession', BreakSessionSchema);

export default BreakSession;

