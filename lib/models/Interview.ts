import mongoose, { Schema, Document, Model } from 'mongoose';

export type InterviewMode = 'in_person' | 'video' | 'telephonic';
export type InterviewStatus = 
  | 'scheduled' 
  | 'rescheduled' 
  | 'completed' 
  | 'cancelled' 
  | 'no_show' 
  | 'in_progress';

export interface IInterview extends Document {
  // Unique identifiers
  interviewId: string; // e.g., "INT-2025-001"
  
  // References
  candidateId: mongoose.Types.ObjectId;
  jobRequisitionId: mongoose.Types.ObjectId;
  
  // Interview details
  roundName: string; // e.g., "HR Screening", "Technical Round"
  roundOrder: number; // Sequence order (1, 2, 3...)
  roundType: 'hr_screening' | 'technical' | 'managerial' | 'hr_final' | 'panel' | 'custom';
  
  // Scheduling
  scheduledDate: Date;
  scheduledStartTime: Date; // Full datetime
  scheduledEndTime: Date; // Full datetime
  mode: InterviewMode;
  location?: string; // For in-person interviews
  interviewLink?: string; // For video interviews (Google Meet, Zoom, etc.)
  meetingId?: string; // Meeting ID for video calls
  meetingPassword?: string; // Meeting password if required
  
  // Participants
  interviewers: mongoose.Types.ObjectId[]; // Array of User IDs (for panel interviews)
  primaryInterviewerId: mongoose.Types.ObjectId; // Main interviewer
  
  // Status and tracking
  status: InterviewStatus;
  actualStartTime?: Date; // When interview actually started
  actualEndTime?: Date; // When interview actually ended
  duration?: number; // Actual duration in minutes
  
  // Feedback status
  feedbackSubmitted: boolean; // Whether feedback has been submitted by all interviewers
  feedbackSubmittedBy: mongoose.Types.ObjectId[]; // Array of User IDs who submitted feedback
  feedbackDueDate?: Date; // Deadline for feedback submission
  
  // Reschedule tracking
  rescheduledFrom?: Date; // Original scheduled time if rescheduled
  rescheduleReason?: string;
  rescheduleCount: number; // Number of times rescheduled
  
  // Notes
  interviewNotes?: string; // General notes before/after interview
  noShowReason?: string; // If status is no_show
  
  // Metadata
  scheduledBy: mongoose.Types.ObjectId; // HR/Recruiter who scheduled
  cancelledBy?: mongoose.Types.ObjectId; // Who cancelled (if cancelled)
  cancelledAt?: Date;
  cancellationReason?: string;
  
  // Calendar integration
  calendarEventId?: string; // Google Calendar / Outlook event ID
  calendarLink?: string; // Link to calendar event
  
  createdAt: Date;
  updatedAt: Date;
}

const InterviewSchema = new Schema<IInterview>(
  {
    interviewId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
    roundType: {
      type: String,
      enum: ['hr_screening', 'technical', 'managerial', 'hr_final', 'panel', 'custom'],
      required: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },
    scheduledStartTime: {
      type: Date,
      required: true,
      index: true,
    },
    scheduledEndTime: {
      type: Date,
      required: true,
    },
    mode: {
      type: String,
      enum: ['in_person', 'video', 'telephonic'],
      required: true,
    },
    location: {
      type: String,
      trim: true,
    },
    interviewLink: {
      type: String,
      trim: true,
    },
    meetingId: {
      type: String,
      trim: true,
    },
    meetingPassword: {
      type: String,
      trim: true,
    },
    interviewers: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      required: true,
      validate: {
        validator: function (arr: mongoose.Types.ObjectId[]) {
          return arr.length > 0;
        },
        message: 'At least one interviewer is required',
      },
    },
    primaryInterviewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'rescheduled', 'completed', 'cancelled', 'no_show', 'in_progress'],
      default: 'scheduled',
      required: true,
      index: true,
    },
    actualStartTime: {
      type: Date,
      default: null,
    },
    actualEndTime: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number,
      min: 0,
    },
    feedbackSubmitted: {
      type: Boolean,
      default: false,
      index: true,
    },
    feedbackSubmittedBy: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    feedbackDueDate: {
      type: Date,
      default: null,
    },
    rescheduledFrom: {
      type: Date,
      default: null,
    },
    rescheduleReason: {
      type: String,
      trim: true,
    },
    rescheduleCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    interviewNotes: {
      type: String,
      trim: true,
    },
    noShowReason: {
      type: String,
      trim: true,
    },
    scheduledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    calendarEventId: {
      type: String,
      trim: true,
    },
    calendarLink: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
InterviewSchema.index({ candidateId: 1, roundOrder: 1 });
InterviewSchema.index({ primaryInterviewerId: 1, status: 1, scheduledStartTime: 1 });
InterviewSchema.index({ scheduledStartTime: 1, status: 1 }); // For calendar views
InterviewSchema.index({ status: 1, feedbackSubmitted: 1 });
InterviewSchema.index({ jobRequisitionId: 1, status: 1 });

// Compound index for interviewer dashboard
InterviewSchema.index({ primaryInterviewerId: 1, scheduledDate: 1, status: 1 });

const Interview: Model<IInterview> =
  mongoose.models.Interview ||
  mongoose.model<IInterview>('Interview', InterviewSchema);

export default Interview;
