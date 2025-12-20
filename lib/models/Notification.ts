import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'cycle_started' | 'cycle_deadline' | 'review_pending' | 'review_submitted' | 'cycle_closed' | 'reminder' | 'onboarding_invited' | 'onboarding_pending' | 'onboarding_submitted' | 'onboarding_approved' | 'onboarding_rejected' | 'onboarding_changes_requested';
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  relatedId?: mongoose.Types.ObjectId; // Cycle ID, Review ID, etc.
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['cycle_started', 'cycle_deadline', 'review_pending', 'review_submitted', 'cycle_closed', 'reminder', 'onboarding_invited', 'onboarding_pending', 'onboarding_submitted', 'onboarding_approved', 'onboarding_rejected', 'onboarding_changes_requested'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    relatedId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;

