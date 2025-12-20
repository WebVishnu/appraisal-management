import mongoose, { Schema, Document, Model } from 'mongoose';

export type OnboardingAuditAction =
  | 'onboarding_created'
  | 'invitation_sent'
  | 'onboarding_started'
  | 'step_completed'
  | 'onboarding_submitted'
  | 'changes_requested'
  | 'onboarding_approved'
  | 'onboarding_rejected'
  | 'reminder_sent'
  | 'token_regenerated'
  | 'employee_activated'
  | 'manager_acknowledged'
  | 'hr_updated_submission'
  | 'onboarding_deleted';

export interface IOnboardingAudit extends Document {
  onboardingRequestId: mongoose.Types.ObjectId;
  action: OnboardingAuditAction;
  performedBy: mongoose.Types.ObjectId; // User who performed the action
  performedAt: Date;
  description: string;
  metadata?: {
    // Additional context
    step?: string;
    field?: string;
    oldValue?: any;
    newValue?: any;
    comments?: string;
    reason?: string;
  };
  ipAddress?: string;
  userAgent?: string;
}

const OnboardingAuditSchema = new Schema<IOnboardingAudit>(
  {
    onboardingRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'OnboardingRequest',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'onboarding_created',
        'invitation_sent',
        'onboarding_started',
        'step_completed',
        'onboarding_submitted',
        'changes_requested',
        'onboarding_approved',
        'onboarding_rejected',
        'reminder_sent',
        'token_regenerated',
        'employee_activated',
        'manager_acknowledged',
        'hr_updated_submission',
        'onboarding_deleted',
      ],
      required: true,
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    performedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
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
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
OnboardingAuditSchema.index({ onboardingRequestId: 1, performedAt: -1 });
OnboardingAuditSchema.index({ action: 1, performedAt: -1 });
OnboardingAuditSchema.index({ performedBy: 1, performedAt: -1 });

const OnboardingAudit: Model<IOnboardingAudit> =
  mongoose.models.OnboardingAudit ||
  mongoose.model<IOnboardingAudit>('OnboardingAudit', OnboardingAuditSchema);

export default OnboardingAudit;
