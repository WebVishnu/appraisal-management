import mongoose, { Schema, Document, Model } from 'mongoose';

export type AuditActionType =
  | 'candidate_created'
  | 'candidate_updated'
  | 'candidate_status_changed'
  | 'interview_scheduled'
  | 'interview_rescheduled'
  | 'interview_cancelled'
  | 'interview_completed'
  | 'interview_no_show'
  | 'feedback_submitted'
  | 'feedback_updated'
  | 'offer_created'
  | 'offer_approved'
  | 'offer_sent'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'offer_expired'
  | 'offer_withdrawn'
  | 'onboarding_converted'
  | 'candidate_converted_to_employee'
  | 'onboarding_deleted'
  | 'decision_made'
  | 'notes_added'
  | 'document_uploaded';

export interface IInterviewAuditLog extends Document {
  // References
  candidateId?: mongoose.Types.ObjectId;
  interviewId?: mongoose.Types.ObjectId;
  offerId?: mongoose.Types.ObjectId;
  jobRequisitionId?: mongoose.Types.ObjectId;
  
  // Action details
  action: AuditActionType;
  actionDescription: string; // Human-readable description
  previousValue?: any; // Previous state/value (for updates)
  newValue?: any; // New state/value (for updates)
  
  // Actor
  performedBy: mongoose.Types.ObjectId; // User who performed the action
  performedByRole: 'hr' | 'manager' | 'interviewer' | 'candidate' | 'super_admin' | 'system';
  
  // Additional context
  metadata?: Record<string, any>; // Additional context data
  ipAddress?: string; // IP address for security tracking
  userAgent?: string; // User agent for security tracking
  
  // Timestamp
  timestamp: Date;
  
  createdAt: Date;
}

const InterviewAuditLogSchema = new Schema<IInterviewAuditLog>(
  {
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
      index: true,
    },
    interviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Interview',
      index: true,
    },
    offerId: {
      type: Schema.Types.ObjectId,
      ref: 'Offer',
      index: true,
    },
    jobRequisitionId: {
      type: Schema.Types.ObjectId,
      ref: 'JobRequisition',
      index: true,
    },
    action: {
      type: String,
      enum: [
        'candidate_created',
        'candidate_updated',
        'candidate_status_changed',
        'interview_scheduled',
        'interview_rescheduled',
        'interview_cancelled',
        'interview_completed',
        'interview_no_show',
        'feedback_submitted',
        'feedback_updated',
        'offer_created',
        'offer_approved',
        'offer_sent',
        'offer_accepted',
        'offer_rejected',
        'offer_expired',
        'offer_withdrawn',
        'onboarding_converted',
        'candidate_converted_to_employee',
        'onboarding_deleted',
        'decision_made',
        'notes_added',
        'document_uploaded',
      ],
      required: true,
      index: true,
    },
    actionDescription: {
      type: String,
      required: true,
      trim: true,
    },
    previousValue: {
      type: Schema.Types.Mixed,
    },
    newValue: {
      type: Schema.Types.Mixed,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    performedByRole: {
      type: String,
      enum: ['hr', 'manager', 'interviewer', 'candidate', 'super_admin', 'system'],
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
InterviewAuditLogSchema.index({ candidateId: 1, timestamp: -1 });
InterviewAuditLogSchema.index({ interviewId: 1, timestamp: -1 });
InterviewAuditLogSchema.index({ action: 1, timestamp: -1 });
InterviewAuditLogSchema.index({ performedBy: 1, timestamp: -1 });
InterviewAuditLogSchema.index({ jobRequisitionId: 1, timestamp: -1 });

// TTL index to automatically delete logs older than 2 years (optional, for compliance)
// InterviewAuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

const InterviewAuditLog: Model<IInterviewAuditLog> =
  mongoose.models.InterviewAuditLog ||
  mongoose.model<IInterviewAuditLog>('InterviewAuditLog', InterviewAuditLogSchema);

export default InterviewAuditLog;
