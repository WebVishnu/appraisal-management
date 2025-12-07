import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISelfReview extends Document {
  cycleId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  ratings: Record<string, number | string>;
  comments: string;
  status: 'draft' | 'submitted';
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SelfReviewSchema = new Schema<ISelfReview>(
  {
    cycleId: {
      type: Schema.Types.ObjectId,
      ref: 'AppraisalCycle',
      required: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    ratings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    comments: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted'],
      default: 'draft',
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one review per employee per cycle
SelfReviewSchema.index({ cycleId: 1, employeeId: 1 }, { unique: true });

const SelfReview: Model<ISelfReview> =
  mongoose.models.SelfReview || mongoose.model<ISelfReview>('SelfReview', SelfReviewSchema);

export default SelfReview;

