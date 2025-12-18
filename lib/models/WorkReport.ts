import mongoose, { Schema, Document, Model } from 'mongoose';

export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'returned';
export type ReportFrequency = 'daily' | 'weekly';

export interface IWorkReportTask {
  title: string;
  category: 'development' | 'testing' | 'meeting' | 'support' | 'learning' | 'documentation' | 'other';
  description: string;
  timeSpent: number; // in minutes
  status: 'completed' | 'in_progress' | 'blocked';
  blockerReason?: string;
}

export interface IWorkReport extends Document {
  employeeId: mongoose.Types.ObjectId;
  reportDate: Date; // Date for daily, start date for weekly
  endDate?: Date; // End date for weekly reports
  frequency: ReportFrequency;
  status: ReportStatus;
  
  // Auto-filled metadata
  employeeName: string;
  employeeRole: string;
  managerId?: mongoose.Types.ObjectId;
  managerName?: string;
  shift?: string;
  attendanceStatus?: 'present' | 'absent' | 'leave' | 'half_day';
  
  // Tasks
  tasks: IWorkReportTask[];
  
  // Daily summary
  keyAchievements: string;
  challengesFaced: string;
  supportNeeded: string;
  selfProductivityRating: number; // 1-5
  
  // Manager review
  managerReview?: {
    reviewedBy: mongoose.Types.ObjectId;
    reviewedAt: Date;
    taskComments?: Array<{
      taskIndex: number;
      comment: string;
    }>;
    overallFeedback?: string;
    managerProductivityRating?: number; // 1-5
    flag?: 'under_utilized' | 'overloaded' | 'needs_support' | 'excellent' | null;
    approved: boolean;
    returnedReason?: string;
  };
  
  // Calculated fields
  totalWorkHours: number; // Auto-calculated from tasks
  taskCompletionCount: number; // Auto-calculated
  blockedTasksCount: number; // Auto-calculated
  productivityScore?: number; // System-generated
  
  // Attendance mismatch detection
  attendanceMismatch?: {
    detected: boolean;
    reason: string;
  };
  
  submittedAt?: Date;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkReportTaskSchema = new Schema<IWorkReportTask>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['development', 'testing', 'meeting', 'support', 'learning', 'documentation', 'other'],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    timeSpent: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['completed', 'in_progress', 'blocked'],
      required: true,
    },
    blockerReason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { _id: false }
);

const WorkReportSchema = new Schema<IWorkReport>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    reportDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly'],
      required: true,
      default: 'daily',
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'returned'],
      default: 'draft',
      index: true,
    },
    employeeName: {
      type: String,
      required: true,
    },
    employeeRole: {
      type: String,
      required: true,
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    managerName: {
      type: String,
      default: null,
    },
    shift: {
      type: String,
      default: null,
    },
    attendanceStatus: {
      type: String,
      enum: ['present', 'absent', 'leave', 'half_day'],
      default: null,
    },
    tasks: {
      type: [WorkReportTaskSchema],
      default: [],
    },
    keyAchievements: {
      type: String,
      required: true,
      trim: true,
    },
    challengesFaced: {
      type: String,
      required: true,
      trim: true,
    },
    supportNeeded: {
      type: String,
      default: '',
      trim: true,
    },
    selfProductivityRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    managerReview: {
      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      taskComments: [{
        taskIndex: Number,
        comment: String,
      }],
      overallFeedback: {
        type: String,
        default: null,
        trim: true,
      },
      managerProductivityRating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
      },
      flag: {
        type: String,
        enum: ['under_utilized', 'overloaded', 'needs_support', 'excellent', null],
        default: null,
      },
      approved: {
        type: Boolean,
        default: false,
      },
      returnedReason: {
        type: String,
        default: null,
        trim: true,
      },
    },
    totalWorkHours: {
      type: Number,
      default: 0,
    },
    taskCompletionCount: {
      type: Number,
      default: 0,
    },
    blockedTasksCount: {
      type: Number,
      default: 0,
    },
    productivityScore: {
      type: Number,
      default: null,
    },
    attendanceMismatch: {
      detected: {
        type: Boolean,
        default: false,
      },
      reason: {
        type: String,
        default: null,
      },
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
WorkReportSchema.index({ employeeId: 1, reportDate: -1 });
WorkReportSchema.index({ managerId: 1, status: 1, reportDate: -1 });
WorkReportSchema.index({ status: 1, reportDate: -1 });
WorkReportSchema.index({ employeeId: 1, status: 1 });

// Compound unique index - one report per employee per date
WorkReportSchema.index({ employeeId: 1, reportDate: 1, frequency: 1 }, { unique: true });

// Pre-save hook to calculate derived fields
WorkReportSchema.pre('save', function (next) {
  // Calculate total work hours from tasks (convert minutes to hours)
  this.totalWorkHours = this.tasks.reduce((sum, task) => sum + task.timeSpent, 0) / 60;
  
  // Calculate task completion count
  this.taskCompletionCount = this.tasks.filter(task => task.status === 'completed').length;
  
  // Calculate blocked tasks count
  this.blockedTasksCount = this.tasks.filter(task => task.status === 'blocked').length;
  
  next();
});

const WorkReport: Model<IWorkReport> =
  mongoose.models.WorkReport || mongoose.model<IWorkReport>('WorkReport', WorkReportSchema);

export default WorkReport;

