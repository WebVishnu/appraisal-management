import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRoster extends Document {
  employeeId: mongoose.Types.ObjectId;
  shiftId: mongoose.Types.ObjectId;
  date: Date; // The date for this roster entry
  weekNumber?: number; // Week number for weekly rosters
  month?: number; // Month for monthly rosters
  year: number;
  isWeeklyOff: boolean; // If this is a weekly off day
  notes?: string;
  createdBy: mongoose.Types.ObjectId; // User who created the roster
  createdAt: Date;
  updatedAt: Date;
}

const RosterSchema = new Schema<IRoster>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    weekNumber: {
      type: Number,
      min: 1,
      max: 53,
    },
    month: {
      type: Number,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    isWeeklyOff: {
      type: Boolean,
      default: false,
    },
    notes: {
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

// Compound unique index: one roster entry per employee per date
RosterSchema.index({ employeeId: 1, date: 1 }, { unique: true });

// Indexes for efficient queries
RosterSchema.index({ employeeId: 1, year: 1, month: 1 });
RosterSchema.index({ employeeId: 1, year: 1, weekNumber: 1 });
RosterSchema.index({ date: 1, shiftId: 1 });

const Roster: Model<IRoster> = mongoose.models.Roster || mongoose.model<IRoster>('Roster', RosterSchema);

export default Roster;

