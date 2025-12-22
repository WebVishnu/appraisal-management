import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

export interface IPasswordReset extends Document {
  userId: mongoose.Types.ObjectId;
  token: string; // Hashed
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
  ipAddress?: string;
  createdAt: Date;
}

const PasswordResetSchema = new Schema<IPasswordReset>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      // Index defined below with TTL option
      default: () => new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    },
    used: {
      type: Boolean,
      default: false,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for cleanup
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PasswordResetSchema.index({ userId: 1, used: 1 });

// Static method to generate reset token
PasswordResetSchema.statics.generateToken = function (): string {
  return crypto.randomBytes(32).toString('hex');
};

// Static method to hash token
PasswordResetSchema.statics.hashToken = function (token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
};

interface IPasswordResetModel extends Model<IPasswordReset> {
  generateToken(): string;
  hashToken(token: string): string;
}

const PasswordReset: IPasswordResetModel =
  (mongoose.models.PasswordReset as IPasswordResetModel) ||
  mongoose.model<IPasswordReset, IPasswordResetModel>('PasswordReset', PasswordResetSchema);

export default PasswordReset;

