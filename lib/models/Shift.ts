import mongoose, { Schema, Document, Model } from 'mongoose';

export type ShiftType = 'fixed' | 'rotational' | 'flexible';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface IShift extends Document {
  name: string;
  shiftType: ShiftType;
  startTime: string; // HH:mm format (e.g., "09:00")
  endTime: string; // HH:mm format (e.g., "18:00")
  gracePeriod: number; // minutes allowed for late arrival
  earlyExitGracePeriod: number; // minutes allowed for early exit
  minimumWorkingHours: number; // minimum hours required (in minutes)
  breakDuration: number; // break duration in minutes
  isBreakPaid: boolean; // whether break is paid
  workingDays: DayOfWeek[]; // days when shift is active
  isNightShift: boolean; // if shift crosses midnight
  isActive: boolean; // active or archived
  description?: string;
  createdBy: mongoose.Types.ObjectId; // User who created
  createdAt: Date;
  updatedAt: Date;
}

const ShiftSchema = new Schema<IShift>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    shiftType: {
      type: String,
      enum: ['fixed', 'rotational', 'flexible'],
      required: true,
    },
    startTime: {
      type: String,
      required: true,
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, // HH:mm format validation
    },
    endTime: {
      type: String,
      required: true,
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/,
    },
    gracePeriod: {
      type: Number,
      required: true,
      default: 15, // 15 minutes default
      min: 0,
    },
    earlyExitGracePeriod: {
      type: Number,
      required: true,
      default: 15,
      min: 0,
    },
    minimumWorkingHours: {
      type: Number,
      required: true,
      min: 0, // in minutes
    },
    breakDuration: {
      type: Number,
      required: true,
      default: 60, // 1 hour default
      min: 0,
    },
    isBreakPaid: {
      type: Boolean,
      default: false,
    },
    workingDays: {
      type: [String],
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true,
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: 'At least one working day must be specified',
      },
    },
    isNightShift: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
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

// Index for efficient queries
ShiftSchema.index({ isActive: 1, shiftType: 1 });
ShiftSchema.index({ name: 1 }, { unique: true });

const Shift: Model<IShift> = mongoose.models.Shift || mongoose.model<IShift>('Shift', ShiftSchema);

export default Shift;

