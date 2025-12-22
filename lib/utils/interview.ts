/**
 * Interview management utility functions
 * Handles ID generation, token generation, and helper functions
 */

import crypto from 'crypto';

/**
 * Generate unique candidate ID (e.g., CAN-2025-001)
 */
export function generateCandidateId(year: number, sequence: number): string {
  return `CAN-${year}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Generate unique job requisition ID (e.g., REQ-2025-001)
 */
export function generateJobRequisitionId(year: number, sequence: number): string {
  return `REQ-${year}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Generate unique interview ID (e.g., INT-2025-001)
 */
export function generateInterviewId(year: number, sequence: number): string {
  return `INT-${year}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Generate unique offer ID (e.g., OFF-2025-001)
 */
export function generateOfferId(year: number, sequence: number): string {
  return `OFF-${year}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Generate a secure random token for offer acceptance link
 */
export function generateOfferToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a secure random token for public job application link
 */
export function generatePublicJobToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate offer acceptance link
 */
export function generateOfferLink(token: string, baseUrl: string = process.env.NEXTAUTH_URL || 'http://localhost:3000'): string {
  return `${baseUrl}/offer/${token}`;
}

/**
 * Calculate overall candidate score from interview feedbacks
 */
export function calculateOverallScore(feedbacks: Array<{ overallScore: number; weightage?: number }>): number {
  if (!feedbacks || feedbacks.length === 0) return 0;
  
  if (feedbacks.every(f => f.weightage !== undefined)) {
    // Weighted average
    const totalWeight = feedbacks.reduce((sum, f) => sum + (f.weightage || 0), 0);
    if (totalWeight === 0) return 0;
    
    const weightedSum = feedbacks.reduce((sum, f) => sum + (f.overallScore * (f.weightage || 0)), 0);
    return Math.round(weightedSum / totalWeight);
  } else {
    // Simple average
    const sum = feedbacks.reduce((sum, f) => sum + f.overallScore, 0);
    return Math.round(sum / feedbacks.length);
  }
}

/**
 * Check if interview feedback deadline is approaching (within 24 hours)
 */
export function isFeedbackDeadlineApproaching(dueDate: Date): boolean {
  const now = new Date();
  const diff = dueDate.getTime() - now.getTime();
  const hoursUntilDeadline = diff / (1000 * 60 * 60);
  return hoursUntilDeadline <= 24 && hoursUntilDeadline > 0;
}

/**
 * Check if feedback deadline has passed
 */
export function isFeedbackDeadlinePassed(dueDate: Date): boolean {
  return new Date() > dueDate;
}

/**
 * Check if offer validity has expired
 */
export function isOfferExpired(validUntil: Date): boolean {
  return new Date() > validUntil;
}

/**
 * Get next interview round name based on current round
 */
export function getNextRoundName(currentRound: number, rounds: Array<{ roundOrder: number; roundName: string }>): string | null {
  const nextRound = rounds.find(r => r.roundOrder === currentRound + 1);
  return nextRound?.roundName || null;
}

/**
 * Check if all mandatory rounds are completed
 */
export function areAllMandatoryRoundsCompleted(
  completedRounds: number[],
  rounds: Array<{ roundOrder: number; isMandatory: boolean }>
): boolean {
  const mandatoryRounds = rounds.filter(r => r.isMandatory).map(r => r.roundOrder);
  return mandatoryRounds.every(roundOrder => completedRounds.includes(roundOrder));
}

/**
 * Format interview duration in minutes to human-readable format
 */
export function formatInterviewDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Calculate interview duration from start and end times
 */
export function calculateInterviewDuration(startTime: Date, endTime: Date): number {
  const diff = endTime.getTime() - startTime.getTime();
  return Math.round(diff / (1000 * 60)); // Return in minutes
}
