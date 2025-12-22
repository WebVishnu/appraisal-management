import mongoose, { Schema, Document, Model } from 'mongoose';

export type JobStatus = 'open' | 'on_hold' | 'closed' | 'cancelled';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';

export interface IInterviewRoundTemplate {
  roundName: string; // e.g., "HR Screening", "Technical Round", "Managerial Round"
  roundOrder: number; // Sequence order (1, 2, 3...)
  roundType: 'hr_screening' | 'technical' | 'managerial' | 'hr_final' | 'panel' | 'custom';
  requiredInterviewers: number; // Minimum number of interviewers needed
  evaluationCriteria: Array<{
    criterion: string; // e.g., "Technical Skills", "Problem Solving"
    weightage: number; // Percentage weight (1-100)
    description?: string;
  }>;
  passingScore?: number; // Minimum score to pass (0-100)
  isMandatory: boolean; // Must complete this round to proceed
}

export interface IJobRequisition extends Document {
  // Unique identifiers
  jobRequisitionId: string; // e.g., "REQ-2025-001"
  jobTitle: string;
  department: string;
  location: string;
  employmentType: EmploymentType;
  
  // Job details
  description: string; // Job description
  requirements: string; // Requirements
  responsibilities?: string; // Key responsibilities
  requiredSkills: string[]; // Array of skill names
  preferredSkills?: string[]; // Optional preferred skills
  experienceRange: {
    min: number; // Years
    max?: number; // Years (optional)
  };
  
  // Hiring details
  hiringManagerId: mongoose.Types.ObjectId; // Employee reference
  recruiterId?: mongoose.Types.ObjectId; // HR/Recruiter assigned
  numberOfPositions: number; // How many positions to fill
  positionsFilled: number; // Count of candidates converted to employees
  
  // Interview configuration
  interviewRounds: IInterviewRoundTemplate[];
  
  // Status and dates
  status: JobStatus;
  postedDate?: Date; // When job was posted
  closingDate?: Date; // Application deadline
  expectedStartDate?: Date; // Expected joining date
  
  // Budget/Compensation
  salaryRange?: {
    min: number;
    max?: number;
    currency: string; // e.g., "INR", "USD"
  };
  
  // Public application fields
  publicToken?: string; // Unique token for public access
  allowPublicApplications: boolean; // Enable/disable public applications
  publicApplicationDeadline?: Date; // When public applications close
  
  // Metadata
  createdBy: mongoose.Types.ObjectId; // User who created
  isActive: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

const InterviewRoundTemplateSchema = new Schema<IInterviewRoundTemplate>(
  {
    roundName: { type: String, required: true, trim: true },
    roundOrder: { type: Number, required: true, min: 1 },
    roundType: {
      type: String,
      enum: ['hr_screening', 'technical', 'managerial', 'hr_final', 'panel', 'custom'],
      required: true,
    },
    requiredInterviewers: { type: Number, required: true, min: 1, default: 1 },
    evaluationCriteria: {
      type: [
        {
          criterion: { type: String, required: true, trim: true },
          weightage: { type: Number, required: true, min: 1, max: 100 },
          description: { type: String, trim: true },
        },
      ],
      default: [],
    },
    passingScore: { type: Number, min: 0, max: 100 },
    isMandatory: { type: Boolean, default: true },
  },
  { _id: false }
);

const JobRequisitionSchema = new Schema<IJobRequisition>(
  {
    jobRequisitionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    jobTitle: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'intern'],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    requirements: {
      type: String,
      required: true,
      trim: true,
    },
    responsibilities: {
      type: String,
      trim: true,
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
    preferredSkills: {
      type: [String],
      default: [],
    },
    experienceRange: {
      min: { type: Number, required: true, min: 0 },
      max: { type: Number, min: 0 },
    },
    hiringManagerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    recruiterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    numberOfPositions: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    positionsFilled: {
      type: Number,
      default: 0,
      min: 0,
    },
    interviewRounds: {
      type: [InterviewRoundTemplateSchema],
      required: true,
      validate: {
        validator: function (rounds: IInterviewRoundTemplate[]) {
          // Validate round order is sequential and starts from 1
          const orders = rounds.map(r => r.roundOrder).sort((a, b) => a - b);
          return orders[0] === 1 && orders.every((val, idx) => val === idx + 1);
        },
        message: 'Interview rounds must have sequential order starting from 1',
      },
    },
    status: {
      type: String,
      enum: ['open', 'on_hold', 'closed', 'cancelled'],
      default: 'open',
      required: true,
      index: true,
    },
    postedDate: {
      type: Date,
      default: null,
    },
    closingDate: {
      type: Date,
      default: null,
    },
    expectedStartDate: {
      type: Date,
      default: null,
    },
    salaryRange: {
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
      currency: { type: String, default: 'INR', trim: true },
    },
    publicToken: {
      type: String,
      trim: true,
      sparse: true, // Allows multiple nulls
      select: false, // Don't select by default for security
    },
    allowPublicApplications: {
      type: Boolean,
      default: false,
    },
    publicApplicationDeadline: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
JobRequisitionSchema.index({ status: 1, createdAt: -1 });
JobRequisitionSchema.index({ department: 1, status: 1 });
JobRequisitionSchema.index({ hiringManagerId: 1, status: 1 });
JobRequisitionSchema.index({ recruiterId: 1, status: 1 });
JobRequisitionSchema.index({ publicToken: 1 }, { sparse: true }); // For public API lookups - sparse to allow multiple nulls

const JobRequisition: Model<IJobRequisition> =
  mongoose.models.JobRequisition ||
  mongoose.model<IJobRequisition>('JobRequisition', JobRequisitionSchema);

export default JobRequisition;
