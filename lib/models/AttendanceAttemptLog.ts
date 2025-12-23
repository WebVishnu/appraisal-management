import mongoose, { Schema, Document, Model } from 'mongoose';

export type AttemptType = 'check_in' | 'check_out';
export type AttemptStatus = 'success' | 'failed' | 'blocked' | 'override';
export type FailureReason = 
  | 'wifi_not_connected'
  | 'wifi_not_allowed'
  | 'wifi_validation_failed'
  | 'policy_violation'
  | 'network_error'
  | 'permission_denied'
  | 'other';

export interface IAttendanceAttemptLog extends Document {
  employeeId: mongoose.Types.ObjectId;
  attemptType: AttemptType;
  status: AttemptStatus;
  
  // WiFi information at time of attempt
  wifiSSID?: string;
  wifiBSSID?: string;
  isWiFiConnected: boolean;
  isMobileData: boolean;
  
  // Policy information
  appliedPolicyId?: mongoose.Types.ObjectId;
  policyScope?: string;
  
  // Validation details
  validationResult: {
    wifiValid: boolean;
    policyApplied: boolean;
    allowed: boolean;
    reason?: string;
  };
  
  // Failure details
  failureReason?: FailureReason;
  failureDetails?: string;
  
  // Override information (if applicable)
  overrideId?: mongoose.Types.ObjectId;
  overrideBy?: mongoose.Types.ObjectId;
  
  // Device information
  deviceInfo?: {
    platform: string; // 'ios' | 'android' | 'web'
    deviceId?: string;
    appVersion?: string;
  };
  
  // Location information (future-ready)
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  };
  
  // Timestamp
  attemptedAt: Date;
  createdAt: Date;
}

const AttendanceAttemptLogSchema = new Schema<IAttendanceAttemptLog>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    attemptType: {
      type: String,
      enum: ['check_in', 'check_out'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'blocked', 'override'],
      required: true,
      index: true,
    },
    wifiSSID: {
      type: String,
      trim: true,
      index: true,
    },
    wifiBSSID: {
      type: String,
      trim: true,
      uppercase: true,
    },
    isWiFiConnected: {
      type: Boolean,
      required: true,
    },
    isMobileData: {
      type: Boolean,
      default: false,
    },
    appliedPolicyId: {
      type: Schema.Types.ObjectId,
      ref: 'WiFiPolicy',
      default: null,
    },
    policyScope: {
      type: String,
      trim: true,
    },
    validationResult: {
      wifiValid: {
        type: Boolean,
        required: true,
      },
      policyApplied: {
        type: Boolean,
        required: true,
      },
      allowed: {
        type: Boolean,
        required: true,
      },
      reason: {
        type: String,
        trim: true,
      },
    },
    failureReason: {
      type: String,
      enum: [
        'wifi_not_connected',
        'wifi_not_allowed',
        'wifi_validation_failed',
        'policy_violation',
        'network_error',
        'permission_denied',
        'other',
      ],
      default: null,
    },
    failureDetails: {
      type: String,
      trim: true,
    },
    overrideId: {
      type: Schema.Types.ObjectId,
      ref: 'AttendanceOverride',
      default: null,
    },
    overrideBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deviceInfo: {
      platform: {
        type: String,
        enum: ['ios', 'android', 'web'],
      },
      deviceId: {
        type: String,
        trim: true,
      },
      appVersion: {
        type: String,
        trim: true,
      },
    },
    location: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180,
      },
      accuracy: {
        type: Number,
        min: 0,
      },
    },
    attemptedAt: {
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
AttendanceAttemptLogSchema.index({ employeeId: 1, attemptedAt: -1 });
AttendanceAttemptLogSchema.index({ status: 1, attemptedAt: -1 });
AttendanceAttemptLogSchema.index({ failureReason: 1, attemptedAt: -1 });
AttendanceAttemptLogSchema.index({ wifiSSID: 1, attemptedAt: -1 });

const AttendanceAttemptLog: Model<IAttendanceAttemptLog> =
  mongoose.models.AttendanceAttemptLog ||
  mongoose.model<IAttendanceAttemptLog>('AttendanceAttemptLog', AttendanceAttemptLogSchema);

export default AttendanceAttemptLog;

