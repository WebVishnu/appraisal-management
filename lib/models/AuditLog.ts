import mongoose, { Schema, Document, Model } from 'mongoose';

export type AuditAction =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'password_reset'
  | 'password_reset_request'
  | 'token_refresh'
  | 'account_locked'
  | 'account_unlocked'
  | 'password_changed'
  | 'account_disabled'
  | 'account_enabled';

export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  action: AuditAction;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: {
    deviceType?: string;
    platform?: string;
    browser?: string;
    os?: string;
  };
  metadata?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'login_success',
        'login_failure',
        'logout',
        'password_reset',
        'password_reset_request',
        'token_refresh',
        'account_locked',
        'account_unlocked',
        'password_changed',
        'account_disabled',
        'account_enabled',
      ],
      index: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    deviceInfo: {
      deviceType: String,
      platform: String,
      browser: String,
      os: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    success: {
      type: Boolean,
      required: true,
      default: true,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ ipAddress: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;

