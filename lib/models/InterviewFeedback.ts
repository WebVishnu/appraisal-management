import mongoose, { Schema, Document, Model } from 'mongoose';

export type RecommendationType = 'strong_yes' | 'yes' | 'hold' | 'no';
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface ICriterionRating {
  criterion: string; // e.g., "Technical Skills", "Problem Solving"
  rating: Rating; // 1-5 scale
  comments?: string; // Specific comments for this criterion
  weightage: number; // Weight from interview round template
}

export interface IInterviewFeedback extends Document {
  // References
  interviewId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  interviewerId: mongoose.Types.ObjectId; // User who submitted feedback
  jobRequisitionId: mongoose.Types.ObjectId;
  
  // Round information
  roundName: string;
  roundOrder: number;
  
  // Structured evaluation
  criterionRatings: ICriterionRating[]; // Ratings for each evaluation criterion
  
  // Overall assessment
  technicalSkillsRating: Rating; // 1-5
  technicalSkillsComments?: string;
  
  problemSolvingRating: Rating; // 1-5
  problemSolvingComments?: string;
  
  communicationRating: Rating; // 1-5
  communicationComments?: string;
  
  cultureFitRating: Rating; // 1-5
  cultureFitComments?: string;
  
  // Overall recommendation
  overallRecommendation: RecommendationType;
  overallScore: number; // Calculated weighted score (0-100)
  overallComments: string; // Detailed feedback
  
  // Strengths and weaknesses
  strengths: string[]; // Array of strengths
  weaknesses: string[]; // Array of weaknesses/areas for improvement
  
  // Specific questions/responses (if applicable)
  keyQuestions?: Array<{
    question: string;
    response: string;
    interviewerNotes?: string;
  }>;
  
  // Hiring decision
  recommendation: 'hire' | 'maybe' | 'reject';
  confidenceLevel: 'high' | 'medium' | 'low'; // Confidence in recommendation
  
  // Additional notes
  interviewerNotes?: string; // Private notes (only visible to HR/Manager)
  candidateFeedback?: string; // Candidate's feedback about the interview experience (optional)
  
  // Submission tracking
  submittedAt: Date;
  isSubmitted: boolean; // Lock feedback after submission
  
  // Version control (in case of edits before submission)
  version: number; // Increment on each save before submission
  lastSavedAt: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const CriterionRatingSchema = new Schema<ICriterionRating>(
  {
    criterion: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comments: { type: String, trim: true },
    weightage: { type: Number, required: true, min: 1, max: 100 },
  },
  { _id: false }
);

const KeyQuestionSchema = new Schema(
  {
    question: { type: String, required: true, trim: true },
    response: { type: String, required: true, trim: true },
    interviewerNotes: { type: String, trim: true },
  },
  { _id: false }
);

const InterviewFeedbackSchema = new Schema<IInterviewFeedback>(
  {
    interviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
      index: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
      index: true,
    },
    interviewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jobRequisitionId: {
      type: Schema.Types.ObjectId,
      ref: 'JobRequisition',
      required: true,
      index: true,
    },
    roundName: {
      type: String,
      required: true,
      trim: true,
    },
    roundOrder: {
      type: Number,
      required: true,
      min: 1,
    },
    criterionRatings: {
      type: [CriterionRatingSchema],
      default: [],
    },
    technicalSkillsRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    technicalSkillsComments: {
      type: String,
      trim: true,
    },
    problemSolvingRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    problemSolvingComments: {
      type: String,
      trim: true,
    },
    communicationRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    communicationComments: {
      type: String,
      trim: true,
    },
    cultureFitRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    cultureFitComments: {
      type: String,
      trim: true,
    },
    overallRecommendation: {
      type: String,
      enum: ['strong_yes', 'yes', 'hold', 'no'],
      required: true,
    },
    overallScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    overallComments: {
      type: String,
      required: true,
      trim: true,
    },
    strengths: {
      type: [String],
      default: [],
    },
    weaknesses: {
      type: [String],
      default: [],
    },
    keyQuestions: {
      type: [KeyQuestionSchema],
      default: [],
    },
    recommendation: {
      type: String,
      enum: ['hire', 'maybe', 'reject'],
      required: true,
    },
    confidenceLevel: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
    interviewerNotes: {
      type: String,
      trim: true,
    },
    candidateFeedback: {
      type: String,
      trim: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    isSubmitted: {
      type: Boolean,
      default: false,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    lastSavedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: One feedback per interviewer per interview
InterviewFeedbackSchema.index({ interviewId: 1, interviewerId: 1 }, { unique: true });

// Indexes for efficient queries
InterviewFeedbackSchema.index({ candidateId: 1, roundOrder: 1 });
InterviewFeedbackSchema.index({ interviewerId: 1, isSubmitted: 1 });
InterviewFeedbackSchema.index({ interviewId: 1, isSubmitted: 1 });

// Calculate overall score before save
InterviewFeedbackSchema.pre('save', function (next) {
  if (this.isModified('criterionRatings') && this.criterionRatings.length > 0) {
    // Calculate weighted average from criterion ratings
    let totalWeightedScore = 0;
    let totalWeight = 0;
    
    this.criterionRatings.forEach((cr) => {
      // Convert 1-5 rating to 0-100 scale (1=0, 2=25, 3=50, 4=75, 5=100)
      const normalizedScore = ((cr.rating - 1) / 4) * 100;
      totalWeightedScore += normalizedScore * (cr.weightage / 100);
      totalWeight += cr.weightage / 100;
    });
    
    if (totalWeight > 0) {
      this.overallScore = Math.round(totalWeightedScore / totalWeight);
    }
  } else {
    // Fallback: Calculate from individual ratings if criterionRatings not used
    const avgRating = (
      this.technicalSkillsRating +
      this.problemSolvingRating +
      this.communicationRating +
      this.cultureFitRating
    ) / 4;
    // Convert 1-5 to 0-100 scale
    this.overallScore = Math.round(((avgRating - 1) / 4) * 100);
  }
  
  this.lastSavedAt = new Date();
  next();
});

const InterviewFeedback: Model<IInterviewFeedback> =
  mongoose.models.InterviewFeedback ||
  mongoose.model<IInterviewFeedback>('InterviewFeedback', InterviewFeedbackSchema);

export default InterviewFeedback;
