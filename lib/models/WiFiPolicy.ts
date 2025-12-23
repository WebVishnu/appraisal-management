import mongoose, { Schema, Document, Model } from 'mongoose';

export type PolicyScope = 'company' | 'office' | 'department' | 'shift' | 'employee';
export type PolicyStatus = 'active' | 'inactive' | 'scheduled';

export interface IWiFiPolicy extends Document {
  name: string; // Policy name for identification
  description?: string;
  
  // Scope configuration
  scope: PolicyScope;
  scopeIds?: {
    officeId?: mongoose.Types.ObjectId; // For 'office' scope
    departmentId?: string; // For 'department' scope
    shiftId?: mongoose.Types.ObjectId; // For 'shift' scope
    employeeId?: mongoose.Types.ObjectId; // For 'employee' scope
  };
  
  // Rule configuration
  requireWiFi: boolean; // Whether WiFi validation is required
  allowedNetworks: mongoose.Types.ObjectId[]; // Array of WiFiNetwork IDs
  allowOverride: boolean; // Whether HR can override this policy
  requireOverrideReason: boolean; // Whether override requires a reason
  
  // Schedule configuration (future-ready)
  effectiveFrom?: Date;
  effectiveTo?: Date;
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  timeRange?: {
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
  
  // Status
  status: PolicyStatus;
  isActive: boolean;
  
  // Metadata
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WiFiPolicySchema = new Schema<IWiFiPolicy>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    scope: {
      type: String,
      enum: ['company', 'office', 'department', 'shift', 'employee'],
      required: true,
      index: true,
    },
    scopeIds: {
      officeId: {
        type: Schema.Types.ObjectId,
        ref: 'Office', // Future model
        default: null,
      },
      departmentId: {
        type: String,
        default: null,
      },
      shiftId: {
        type: Schema.Types.ObjectId,
        ref: 'Shift',
        default: null,
      },
      employeeId: {
        type: Schema.Types.ObjectId,
        ref: 'Employee',
        default: null,
      },
    },
    requireWiFi: {
      type: Boolean,
      default: true,
    },
    allowedNetworks: {
      type: [Schema.Types.ObjectId],
      ref: 'WiFiNetwork',
      default: [],
    },
    allowOverride: {
      type: Boolean,
      default: true,
    },
    requireOverrideReason: {
      type: Boolean,
      default: true,
    },
    effectiveFrom: {
      type: Date,
      default: null,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    daysOfWeek: {
      type: [Number],
      default: [0, 1, 2, 3, 4, 5, 6], // All days by default
      validate: {
        validator: (arr: number[]) => arr.every(d => d >= 0 && d <= 6),
        message: 'Days must be between 0 (Sunday) and 6 (Saturday)',
      },
    },
    timeRange: {
      start: {
        type: String,
        match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, // HH:mm format
      },
      end: {
        type: String,
        match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, // HH:mm format
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'scheduled'],
      default: 'active',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient policy lookups
WiFiPolicySchema.index({ scope: 1, isActive: 1, status: 1 });
WiFiPolicySchema.index({ 'scopeIds.employeeId': 1, isActive: 1 });
WiFiPolicySchema.index({ 'scopeIds.shiftId': 1, isActive: 1 });
WiFiPolicySchema.index({ 'scopeIds.departmentId': 1, isActive: 1 });

const WiFiPolicy: Model<IWiFiPolicy> =
  mongoose.models.WiFiPolicy || mongoose.model<IWiFiPolicy>('WiFiPolicy', WiFiPolicySchema);

export default WiFiPolicy;

