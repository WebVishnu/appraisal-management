import mongoose, { Schema, Document, Model } from 'mongoose';

export type AssignmentType = 'permanent' | 'temporary';
export type AssignmentScope = 'employee' | 'team' | 'department';

export interface IShiftAssignment extends Document {
  shiftId: mongoose.Types.ObjectId;
  assignmentType: AssignmentType;
  assignmentScope: AssignmentScope;
  
  // For employee assignment
  employeeId?: mongoose.Types.ObjectId;
  
  // For team assignment (using managerId as team identifier)
  teamManagerId?: mongoose.Types.ObjectId;
  
  // For department assignment (using role as department identifier)
  departmentRole?: string;
  
  // Date range for temporary assignments
  startDate?: Date;
  endDate?: Date;
  
  // Effective date for permanent assignments
  effectiveDate: Date;
  
  // Audit fields
  assignedBy: mongoose.Types.ObjectId; // User who assigned
  reason?: string; // Reason for assignment
  isActive: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

const ShiftAssignmentSchema = new Schema<IShiftAssignment>(
  {
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
      index: true,
    },
    assignmentType: {
      type: String,
      enum: ['permanent', 'temporary'],
      required: true,
    },
    assignmentScope: {
      type: String,
      enum: ['employee', 'team', 'department'],
      required: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    teamManagerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    departmentRole: {
      type: String,
      default: null,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    effectiveDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
ShiftAssignmentSchema.index({ employeeId: 1, isActive: 1, effectiveDate: -1 });
ShiftAssignmentSchema.index({ teamManagerId: 1, isActive: 1 });
ShiftAssignmentSchema.index({ shiftId: 1, isActive: 1 });
ShiftAssignmentSchema.index({ startDate: 1, endDate: 1 });

// Validation: Ensure at least one assignment target is specified
ShiftAssignmentSchema.pre('validate', function (next) {
  if (this.assignmentScope === 'employee' && !this.employeeId) {
    return next(new Error('employeeId is required for employee assignment'));
  }
  if (this.assignmentScope === 'team' && !this.teamManagerId) {
    return next(new Error('teamManagerId is required for team assignment'));
  }
  if (this.assignmentScope === 'department' && !this.departmentRole) {
    return next(new Error('departmentRole is required for department assignment'));
  }
  
  // Temporary assignments must have date range
  if (this.assignmentType === 'temporary' && (!this.startDate || !this.endDate)) {
    return next(new Error('startDate and endDate are required for temporary assignments'));
  }
  
  if (this.assignmentType === 'temporary' && this.startDate && this.endDate && this.startDate >= this.endDate) {
    return next(new Error('endDate must be after startDate'));
  }
  
  next();
});

const ShiftAssignment: Model<IShiftAssignment> =
  mongoose.models.ShiftAssignment || mongoose.model<IShiftAssignment>('ShiftAssignment', ShiftAssignmentSchema);

export default ShiftAssignment;

