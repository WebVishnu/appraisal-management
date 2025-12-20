/**
 * Candidate State Machine
 * Manages valid state transitions in the hiring pipeline
 */

export type CandidateStatus =
  | 'applied'
  | 'screening'
  | 'shortlisted'
  | 'interview_scheduled'
  | 'interview_in_progress'
  | 'interview_completed'
  | 'offer_pending'
  | 'offer_sent'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'offer_expired'
  | 'selected'
  | 'rejected'
  | 'withdrawn'
  | 'on_hold'
  | 'cancelled';

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  applied: ['screening', 'shortlisted', 'rejected', 'withdrawn', 'on_hold'],
  screening: ['shortlisted', 'rejected', 'withdrawn', 'on_hold'],
  shortlisted: ['interview_scheduled', 'rejected', 'withdrawn', 'on_hold'],
  interview_scheduled: ['interview_in_progress', 'rejected', 'withdrawn', 'on_hold', 'cancelled'],
  interview_in_progress: ['interview_completed', 'rejected', 'withdrawn', 'on_hold'],
  interview_completed: ['offer_pending', 'rejected', 'on_hold'],
  offer_pending: ['offer_sent', 'rejected', 'withdrawn', 'on_hold'],
  offer_sent: ['offer_accepted', 'offer_rejected', 'offer_expired', 'rejected', 'withdrawn'],
  offer_accepted: ['selected'],
  offer_rejected: ['rejected'],
  offer_expired: ['rejected', 'on_hold'],
  selected: [], // Terminal state - converted to onboarding
  rejected: [], // Terminal state
  withdrawn: [], // Terminal state
  on_hold: ['screening', 'shortlisted', 'interview_scheduled', 'rejected', 'withdrawn'],
  cancelled: [], // Terminal state
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  currentStatus: CandidateStatus,
  newStatus: CandidateStatus
): boolean {
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}

/**
 * Get all valid next states for a candidate
 */
export function getValidNextStates(currentStatus: CandidateStatus): CandidateStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Check if status is a terminal state (no further transitions)
 */
export function isTerminalState(status: CandidateStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

/**
 * Check if status allows interview scheduling
 */
export function canScheduleInterview(status: CandidateStatus): boolean {
  return ['shortlisted', 'screening', 'on_hold'].includes(status);
}

/**
 * Check if status allows offer creation
 */
export function canCreateOffer(status: CandidateStatus): boolean {
  return ['interview_completed', 'offer_pending'].includes(status);
}

/**
 * Check if status allows offer acceptance
 */
export function canAcceptOffer(status: CandidateStatus): boolean {
  return status === 'offer_sent';
}

/**
 * Get status display name
 */
export function getStatusDisplayName(status: CandidateStatus): string {
  const displayNames: Record<CandidateStatus, string> = {
    applied: 'Applied',
    screening: 'Screening',
    shortlisted: 'Shortlisted',
    interview_scheduled: 'Interview Scheduled',
    interview_in_progress: 'Interview In Progress',
    interview_completed: 'Interview Completed',
    offer_pending: 'Offer Pending',
    offer_sent: 'Offer Sent',
    offer_accepted: 'Offer Accepted',
    offer_rejected: 'Offer Rejected',
    offer_expired: 'Offer Expired',
    selected: 'Selected',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
    on_hold: 'On Hold',
    cancelled: 'Cancelled',
  };
  return displayNames[status] || status;
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: CandidateStatus): string {
  const colors: Record<CandidateStatus, string> = {
    applied: 'blue',
    screening: 'yellow',
    shortlisted: 'green',
    interview_scheduled: 'blue',
    interview_in_progress: 'purple',
    interview_completed: 'indigo',
    offer_pending: 'orange',
    offer_sent: 'cyan',
    offer_accepted: 'green',
    offer_rejected: 'red',
    offer_expired: 'gray',
    selected: 'green',
    rejected: 'red',
    withdrawn: 'gray',
    on_hold: 'yellow',
    cancelled: 'gray',
  };
  return colors[status] || 'gray';
}

/**
 * Validate and transition candidate status
 * Throws error if transition is invalid
 */
export function transitionCandidateStatus(
  currentStatus: CandidateStatus,
  newStatus: CandidateStatus,
  context?: {
    hasInterviews?: boolean;
    hasCompletedInterviews?: boolean;
    hasOffer?: boolean;
  }
): CandidateStatus {
  if (!isValidTransition(currentStatus, newStatus)) {
    throw new Error(
      `Invalid status transition from ${currentStatus} to ${newStatus}. Valid next states: ${getValidNextStates(currentStatus).join(', ')}`
    );
  }

  // Additional context-based validations
  if (newStatus === 'interview_scheduled' && !canScheduleInterview(currentStatus)) {
    throw new Error('Cannot schedule interview from current status');
  }

  if (newStatus === 'offer_pending' && !canCreateOffer(currentStatus)) {
    throw new Error('Cannot create offer from current status');
  }

  return newStatus;
}

