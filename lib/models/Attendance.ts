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
  notes?: string;
  correctedBy?: mongoose.Types.ObjectId; // HR/Admin who made manual correction
  correctedAt?: Date;
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

