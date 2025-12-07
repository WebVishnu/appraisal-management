import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICompetency {
  name: string;
  type: 'rating' | 'text';
  maxRating?: number;
}

export interface IAppraisalCycle extends Document {
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'draft' | 'open_self_review' | 'open_manager_review' | 'closed';
  competencies: ICompetency[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CompetencySchema = new Schema<ICompetency>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['rating', 'text'],
      required: true,
    },
    maxRating: {
      type: Number,
      default: 5,
    },
  },
  { _id: false }
);

const AppraisalCycleSchema = new Schema<IAppraisalCycle>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'open_self_review', 'open_manager_review', 'closed'],
      default: 'draft',
    },
    competencies: {
      type: [CompetencySchema],
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const AppraisalCycle: Model<IAppraisalCycle> =
  mongoose.models.AppraisalCycle || mongoose.model<IAppraisalCycle>('AppraisalCycle', AppraisalCycleSchema);

export default AppraisalCycle;

