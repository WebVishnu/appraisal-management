import mongoose, { Schema, Document, Model } from 'mongoose';

export type OfferStatus = 
  | 'draft'           // Offer being prepared
  | 'pending_approval' // Awaiting approval from manager/finance
  | 'approved'        // Approved, ready to send
  | 'sent'            // Sent to candidate
  | 'accepted'        // Candidate accepted
  | 'rejected'        // Candidate rejected
  | 'expired'         // Validity period expired
  | 'withdrawn';      // Offer withdrawn by company

export interface ICompensationBreakup {
  annualCTC: number; // Total annual cost to company
  basicSalary: number; // Basic salary (usually 40-50% of CTC)
  hra: number; // House Rent Allowance
  specialAllowance: number; // Special allowances
  lta: number; // Leave Travel Allowance
  medicalAllowance: number; // Medical allowance
  performanceBonus?: number; // Variable/performance bonus
  otherBenefits?: number; // Other benefits
  currency: string; // e.g., "INR", "USD"
}

export interface IOffer extends Document {
  // Unique identifiers
  offerId: string; // e.g., "OFF-2025-001"
  offerToken: string; // Secure token for offer acceptance link
  
  // References
  candidateId: mongoose.Types.ObjectId;
  jobRequisitionId: mongoose.Types.ObjectId;
  
  // Offer details
  jobTitle: string;
  department: string;
  location: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  startDate: Date; // Joining date
  
  // Compensation
  compensation: ICompensationBreakup;
  
  // Additional benefits
  benefits?: string[]; // Array of benefit descriptions
  benefitsDescription?: string; // Detailed benefits description
  
  // Terms and conditions
  noticePeriod?: number; // Days
  probationPeriod?: number; // Months
  workTimings?: string;
  workLocationDetails?: string;
  
  // Offer validity
  offerValidUntil: Date; // Offer expiry date
  offerSentAt?: Date;
  offerAcceptedAt?: Date;
  offerRejectedAt?: Date;
  
  // Status tracking
  status: OfferStatus;
  
  // Approval workflow
  approvedBy: mongoose.Types.ObjectId[]; // Array of User IDs who approved
  approvedAt?: Date;
  requiresApproval: boolean;
  approvalWorkflow: Array<{
    approverId: mongoose.Types.ObjectId;
    approverRole: 'hr' | 'manager' | 'finance' | 'super_admin';
    status: 'pending' | 'approved' | 'rejected';
    approvedAt?: Date;
    comments?: string;
  }>;
  
  // Candidate response
  candidateResponse?: 'accepted' | 'rejected' | 'counter_offer';
  candidateResponseComments?: string;
  candidateCounterOffer?: {
    expectedCTC?: number;
    comments?: string;
  };
  
  // Offer letter document
  offerLetterUrl?: string; // Generated offer letter PDF URL
  
  // Rejection/Withdrawal
  rejectedReason?: string; // If candidate rejected
  withdrawnReason?: string; // If company withdrew
  withdrawnBy?: mongoose.Types.ObjectId;
  withdrawnAt?: Date;
  
  // Conversion to onboarding
  convertedToOnboardingRequestId?: mongoose.Types.ObjectId;
  convertedAt?: Date;
  
  // Metadata
  createdBy: mongoose.Types.ObjectId; // HR who created
  createdFor: mongoose.Types.ObjectId; // Hiring Manager
  
  createdAt: Date;
  updatedAt: Date;
}

const CompensationBreakupSchema = new Schema<ICompensationBreakup>(
  {
    annualCTC: { type: Number, required: true, min: 0 },
    basicSalary: { type: Number, required: true, min: 0 },
    hra: { type: Number, required: true, min: 0 },
    specialAllowance: { type: Number, required: true, min: 0 },
    lta: { type: Number, default: 0, min: 0 },
    medicalAllowance: { type: Number, default: 0, min: 0 },
    performanceBonus: { type: Number, min: 0 },
    otherBenefits: { type: Number, min: 0 },
    currency: { type: String, default: 'INR', trim: true },
  },
  { _id: false }
);

const ApprovalWorkflowItemSchema = new Schema(
  {
    approverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approverRole: {
      type: String,
      enum: ['hr', 'manager', 'finance', 'super_admin'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedAt: { type: Date, default: null },
    comments: { type: String, trim: true },
  },
  { _id: false }
);

const CandidateCounterOfferSchema = new Schema(
  {
    expectedCTC: { type: Number, min: 0 },
    comments: { type: String, trim: true },
  },
  { _id: false }
);

const OfferSchema = new Schema<IOffer>(
  {
    offerId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    offerToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
      index: true,
    },
    jobRequisitionId: {
      type: Schema.Types.ObjectId,
      ref: 'JobRequisition',
      required: true,
      index: true,
    },
    jobTitle: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
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
    startDate: {
      type: Date,
      required: true,
    },
    compensation: {
      type: CompensationBreakupSchema,
      required: true,
    },
    benefits: {
      type: [String],
      default: [],
    },
    benefitsDescription: {
      type: String,
      trim: true,
    },
    noticePeriod: {
      type: Number,
      min: 0,
    },
    probationPeriod: {
      type: Number,
      min: 0,
    },
    workTimings: {
      type: String,
      trim: true,
    },
    workLocationDetails: {
      type: String,
      trim: true,
    },
    offerValidUntil: {
      type: Date,
      required: true,
      index: true,
    },
    offerSentAt: {
      type: Date,
      default: null,
    },
    offerAcceptedAt: {
      type: Date,
      default: null,
    },
    offerRejectedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected', 'expired', 'withdrawn'],
      default: 'draft',
      required: true,
      index: true,
    },
    approvedBy: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    requiresApproval: {
      type: Boolean,
      default: true,
    },
    approvalWorkflow: {
      type: [ApprovalWorkflowItemSchema],
      default: [],
    },
    candidateResponse: {
      type: String,
      enum: ['accepted', 'rejected', 'counter_offer'],
    },
    candidateResponseComments: {
      type: String,
      trim: true,
    },
    candidateCounterOffer: {
      type: CandidateCounterOfferSchema,
      default: null,
    },
    offerLetterUrl: {
      type: String,
      trim: true,
    },
    rejectedReason: {
      type: String,
      trim: true,
    },
    withdrawnReason: {
      type: String,
      trim: true,
    },
    withdrawnBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    withdrawnAt: {
      type: Date,
      default: null,
    },
    convertedToOnboardingRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'OnboardingRequest',
      default: null,
    },
    convertedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdFor: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
OfferSchema.index({ candidateId: 1, status: 1 });
OfferSchema.index({ status: 1, offerValidUntil: 1 });
OfferSchema.index({ createdBy: 1, status: 1 });
OfferSchema.index({ jobRequisitionId: 1, status: 1 });

const Offer: Model<IOffer> =
  mongoose.models.Offer ||
  mongoose.model<IOffer>('Offer', OfferSchema);

export default Offer;
