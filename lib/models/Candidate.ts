import mongoose, { Schema, Document, Model } from 'mongoose';

export type CandidateSource = 
  | 'linkedin' 
  | 'referral' 
  | 'career_page' 
  | 'job_board' 
  | 'naukri' 
  | 'indeed' 
  | 'direct' 
  | 'campus' 
  | 'consultant'
  | 'other';

export type CandidateStatus = 
  | 'applied'           // Initial application
  | 'screening'         // HR screening in progress
  | 'shortlisted'       // Shortlisted for interview
  | 'interview_scheduled' // Interview scheduled
  | 'interview_in_progress' // One or more interviews completed
  | 'interview_completed' // All interviews done, awaiting decision
  | 'offer_pending'     // Offer to be generated
  | 'offer_sent'        // Offer sent to candidate
  | 'offer_accepted'    // Offer accepted
  | 'offer_rejected'    // Candidate rejected offer
  | 'offer_expired'     // Offer validity expired
  | 'selected'          // Selected (offer accepted, ready for onboarding)
  | 'rejected'          // Rejected at any stage
  | 'withdrawn'         // Candidate withdrew
  | 'on_hold';          // Temporarily on hold

export interface ICandidate extends Document {
  // Unique identifiers
  candidateId: string; // e.g., "CAN-2025-001"
  
  // Personal information
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  alternatePhoneNumber?: string;
  
  // Application details
  jobRequisitionId: mongoose.Types.ObjectId;
  appliedPosition: string; // Job title (denormalized for quick access)
  source: CandidateSource;
  referredBy?: mongoose.Types.ObjectId; // Employee who referred (if referral)
  
  // Resume and documents
  resumeUrl?: string; // Resume file URL
  coverLetterUrl?: string; // Cover letter URL
  portfolioUrl?: string; // Portfolio/website URL
  linkedinUrl?: string;
  githubUrl?: string;
  
  // Candidate profile
  currentCompany?: string;
  currentDesignation?: string;
  totalExperience?: number; // Years
  currentCTC?: number; // Current salary
  expectedCTC?: number; // Expected salary
  noticePeriod?: number; // Days
  
  // Status tracking
  status: CandidateStatus;
  currentStage?: string; // Current interview round name
  overallScore?: number; // Calculated score from interviews (0-100)
  
  // Dates
  appliedAt: Date;
  lastActivityAt: Date;
  
  // Assignment
  assignedRecruiterId?: mongoose.Types.ObjectId; // HR/Recruiter assigned
  assignedInterviewerIds?: mongoose.Types.ObjectId[]; // Interviewers assigned (for panel rounds)
  
  // Metadata
  notes?: string; // HR internal notes
  tags?: string[]; // Tags for categorization
  isActive: boolean;
  
  // Conversion tracking
  convertedToEmployeeId?: mongoose.Types.ObjectId; // If converted to employee
  convertedAt?: Date;
  onboardingRequestId?: mongoose.Types.ObjectId; // Link to onboarding after offer acceptance
  
  createdAt: Date;
  updatedAt: Date;
}

const CandidateSchema = new Schema<ICandidate>(
  {
    candidateId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    alternatePhoneNumber: {
      type: String,
      trim: true,
    },
    jobRequisitionId: {
      type: Schema.Types.ObjectId,
      ref: 'JobRequisition',
      required: true,
      index: true,
    },
    appliedPosition: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ['linkedin', 'referral', 'career_page', 'job_board', 'naukri', 'indeed', 'direct', 'campus', 'consultant', 'other'],
      required: true,
      index: true,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    resumeUrl: {
      type: String,
      trim: true,
    },
    coverLetterUrl: {
      type: String,
      trim: true,
    },
    portfolioUrl: {
      type: String,
      trim: true,
    },
    linkedinUrl: {
      type: String,
      trim: true,
    },
    githubUrl: {
      type: String,
      trim: true,
    },
    currentCompany: {
      type: String,
      trim: true,
    },
    currentDesignation: {
      type: String,
      trim: true,
    },
    totalExperience: {
      type: Number,
      min: 0,
    },
    currentCTC: {
      type: Number,
      min: 0,
    },
    expectedCTC: {
      type: Number,
      min: 0,
    },
    noticePeriod: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        'applied',
        'screening',
        'shortlisted',
        'interview_scheduled',
        'interview_in_progress',
        'interview_completed',
        'offer_pending',
        'offer_sent',
        'offer_accepted',
        'offer_rejected',
        'offer_expired',
        'selected',
        'rejected',
        'withdrawn',
        'on_hold',
      ],
      default: 'applied',
      required: true,
      index: true,
    },
    currentStage: {
      type: String,
      trim: true,
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    appliedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    lastActivityAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    assignedRecruiterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedInterviewerIds: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    notes: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    convertedToEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    convertedAt: {
      type: Date,
      default: null,
    },
    onboardingRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'OnboardingRequest',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
CandidateSchema.index({ status: 1, appliedAt: -1 });
CandidateSchema.index({ jobRequisitionId: 1, status: 1 });
CandidateSchema.index({ assignedRecruiterId: 1, status: 1 });
// Note: email index is already created by index: true in field definition

// Compound index for recruiter dashboard
CandidateSchema.index({ assignedRecruiterId: 1, status: 1, lastActivityAt: -1 });

const Candidate: Model<ICandidate> =
  mongoose.models.Candidate ||
  mongoose.model<ICandidate>('Candidate', CandidateSchema);

export default Candidate;
