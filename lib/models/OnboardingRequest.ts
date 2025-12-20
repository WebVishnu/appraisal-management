import mongoose, { Schema, Document, Model } from 'mongoose';

export type OnboardingStatus = 
  | 'invited'           // HR created, invitation sent
  | 'in_progress'       // Employee started filling
  | 'submitted'         // Employee submitted for review
  | 'changes_requested' // HR requested changes
  | 'approved'          // HR approved, ready for activation
  | 'rejected'          // HR rejected
  | 'completed';        // Employee activated, onboarding complete

export interface IOnboardingRequest extends Document {
  // Unique identifiers
  onboardingId: string; // Unique onboarding ID (e.g., ONB-2025-001)
  token: string; // Secure token for onboarding link
  tokenExpiry: Date; // Token expiry date
  
  // Employee information (pre-filled by HR)
  email: string;
  personalEmail?: string; // May differ from company email
  mobileNumber?: string;
  firstName: string;
  lastName: string;
  dateOfJoining: Date;
  department?: string;
  designation?: string;
  reportingManagerId?: mongoose.Types.ObjectId;
  workLocation?: string;
  
  // Status tracking
  status: OnboardingStatus;
  progressPercentage: number; // 0-100
  
  // Dates
  invitedAt: Date;
  startedAt?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  completedAt?: Date;
  expiryDate?: Date; // Overall onboarding deadline
  
  // HR information
  invitedBy: mongoose.Types.ObjectId; // HR who created
  reviewedBy?: mongoose.Types.ObjectId; // HR who reviewed
  approvedBy?: mongoose.Types.ObjectId; // HR who approved
  
  // Comments and notes
  hrNotes?: string; // Internal HR notes
  rejectionReason?: string;
  changeRequestComments?: string; // Comments when requesting changes
  
  // Manager acknowledgement (optional)
  requiresManagerAck: boolean;
  managerAcknowledged: boolean;
  managerAcknowledgedAt?: Date;
  managerAcknowledgedBy?: mongoose.Types.ObjectId;
  
  // Linked employee record (created after approval)
  employeeId?: mongoose.Types.ObjectId; // Created after approval
  userId?: mongoose.Types.ObjectId; // User account created after approval
  
  // Reminders
  lastReminderSentAt?: Date;
  reminderCount: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const OnboardingRequestSchema = new Schema<IOnboardingRequest>(
  {
    onboardingId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    tokenExpiry: {
      type: Date,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    personalEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    dateOfJoining: {
      type: Date,
      required: true,
      index: true,
    },
    department: {
      type: String,
      trim: true,
    },
    designation: {
      type: String,
      trim: true,
    },
    reportingManagerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    workLocation: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['invited', 'in_progress', 'submitted', 'changes_requested', 'approved', 'rejected', 'completed'],
      default: 'invited',
      required: true,
      index: true,
    },
    progressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    invitedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    hrNotes: {
      type: String,
      trim: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    changeRequestComments: {
      type: String,
      trim: true,
    },
    requiresManagerAck: {
      type: Boolean,
      default: false,
    },
    managerAcknowledged: {
      type: Boolean,
      default: false,
    },
    managerAcknowledgedAt: {
      type: Date,
      default: null,
    },
    managerAcknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastReminderSentAt: {
      type: Date,
      default: null,
    },
    reminderCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
OnboardingRequestSchema.index({ status: 1, dateOfJoining: -1 });
OnboardingRequestSchema.index({ email: 1, status: 1 });
// Note: token already has unique: true which creates an index, so we don't need a separate index
OnboardingRequestSchema.index({ invitedBy: 1, status: 1 });
OnboardingRequestSchema.index({ tokenExpiry: 1 }); // For cleanup queries

const OnboardingRequest: Model<IOnboardingRequest> =
  mongoose.models.OnboardingRequest ||
  mongoose.model<IOnboardingRequest>('OnboardingRequest', OnboardingRequestSchema);

export default OnboardingRequest;
