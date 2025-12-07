import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IManagerReview extends Document {
  cycleId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  managerId: mongoose.Types.ObjectId;
  ratings: Record<string, number | string>;
  managerComments: string;
  finalRating: string;
  status: 'draft' | 'submitted';
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ManagerReviewSchema = new Schema<IManagerReview>(
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
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    ratings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    managerComments: {
      type: String,
      default: '',
      trim: true,
    },
    finalRating: {
      type: String,
      required: true,
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
ManagerReviewSchema.index({ cycleId: 1, employeeId: 1 }, { unique: true });

const ManagerReview: Model<IManagerReview> =
  mongoose.models.ManagerReview || mongoose.model<IManagerReview>('ManagerReview', ManagerReviewSchema);

export default ManagerReview;

