import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserStatus = 'invited' | 'active' | 'disabled' | 'locked' | 'password_reset_required';

export interface IUser extends Document {
  email: string;
  password: string;
  role: 'super_admin' | 'hr' | 'manager' | 'employee';
  employeeId?: mongoose.Types.ObjectId;
  status: UserStatus;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  lastLoginIP?: string;
  passwordChangedAt: Date;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual/computed
  isLocked: boolean;
  isActive: boolean;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // Index defined below to avoid duplicate
    },
    password: {
      type: String,
      required: true,
      select: false, // Don't select password by default for security
    },
    role: {
      type: String,
      enum: ['super_admin', 'hr', 'manager', 'employee'],
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['invited', 'active', 'disabled', 'locked', 'password_reset_required'],
      default: 'active',
      index: true,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
      // Index defined below to avoid duplicate
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastLoginIP: {
      type: String,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: Date.now,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for checking if account is active
UserSchema.virtual('isActive').get(function () {
  return this.status === 'active' && !this.isLocked;
});

// Virtual for checking if account is locked
UserSchema.virtual('isLocked').get(function () {
  return this.lockedUntil && this.lockedUntil > new Date();
});

// Indexes
// Note: email index is automatically created by unique: true
UserSchema.index({ status: 1, role: 1 });
UserSchema.index({ lockedUntil: 1 });

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;

