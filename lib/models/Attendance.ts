import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAttendance extends Document {
  employeeId: mongoose.Types.ObjectId;
  date: Date;
  checkIn: Date;
  checkOut?: Date;
  workingHours?: number; // in minutes
  isLate: boolean;
  isEarlyExit: boolean;
  status: 'present' | 'absent' | 'half_day' | 'missed_checkout';
  shiftId?: mongoose.Types.ObjectId; // Assigned shift for this day
  notes?: string;
  correctedBy?: mongoose.Types.ObjectId; // HR/Admin who made manual correction
  correctedAt?: Date;
  // Break management fields
  breaks?: mongoose.Types.ObjectId[]; // Array of BreakSession IDs
  totalBreakDuration?: number; // Total break time in minutes
  netWorkingHours?: number; // Working hours excluding unpaid breaks (in minutes)
  breakViolations?: {
    exceededDailyLimit?: boolean;
    excessiveBreaks?: boolean;
    policyViolations?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    checkIn: {
      type: Date,
      required: true,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    workingHours: {
      type: Number,
      default: null, // in minutes
    },
    isLate: {
      type: Boolean,
      default: false,
    },
    isEarlyExit: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'half_day', 'missed_checkout'],
      default: 'present',
    },
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
      index: true,
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
    // Break management fields
    breaks: {
      type: [Schema.Types.ObjectId],
      ref: 'BreakSession',
      default: [],
    },
    totalBreakDuration: {
      type: Number,
      default: 0, // in minutes
    },
    netWorkingHours: {
      type: Number,
      default: null, // in minutes, calculated
    },
    breakViolations: {
      exceededDailyLimit: {
        type: Boolean,
        default: false,
      },
      excessiveBreaks: {
        type: Boolean,
        default: false,
      },
      policyViolations: {
        type: [String],
        default: [],
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent multiple check-ins per day per employee
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

// Index for efficient date range queries
AttendanceSchema.index({ date: -1, employeeId: 1 });

const Attendance: Model<IAttendance> =
  mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);

export default Attendance;

