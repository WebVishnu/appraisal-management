/**
 * Onboarding utility functions
 * Handles token generation, validation, and Indian document validation
 */

import crypto from 'crypto';

/**
 * Generate a secure random token for onboarding link
 */
export function generateOnboardingToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate unique onboarding ID (e.g., ONB-2025-001)
 */
export function generateOnboardingId(year: number, sequence: number): string {
  return `ONB-${year}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Validate PAN number (Indian)
 * Format: ABCDE1234F (5 letters, 4 digits, 1 letter)
 */
export function validatePAN(pan: string): boolean {
  if (!pan) return false;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase());
}

/**
 * Validate Aadhaar number (Indian)
 * Format: 12 digits
 */
export function validateAadhaar(aadhaar: string): boolean {
  if (!aadhaar) return false;
  // Remove spaces and hyphens
  const cleaned = aadhaar.replace(/[\s-]/g, '');
  // Should be exactly 12 digits
  const aadhaarRegex = /^\d{12}$/;
  return aadhaarRegex.test(cleaned);
}

/**
 * Validate IFSC code (Indian)
 * Format: 4 letters, 0, 6 alphanumeric
 */
export function validateIFSC(ifsc: string): boolean {
  if (!ifsc) return false;
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.toUpperCase());
}

/**
 * Validate Indian mobile number
 * Format: 10 digits starting with 6-9
 */
export function validateIndianMobile(mobile: string): boolean {
  if (!mobile) return false;
  // Remove spaces, dashes, and country code
  const cleaned = mobile.replace(/[\s-+]/g, '').replace(/^91/, '');
  const mobileRegex = /^[6-9]\d{9}$/;
  return mobileRegex.test(cleaned);
}

/**
 * Validate Indian pincode
 * Format: 6 digits
 */
export function validatePincode(pincode: string): boolean {
  if (!pincode) return false;
  const pincodeRegex = /^\d{6}$/;
  return pincodeRegex.test(pincode);
}

/**
 * Format PAN number (uppercase, no spaces)
 */
export function formatPAN(pan: string): string {
  return pan.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Format Aadhaar number (remove spaces/hyphens)
 */
export function formatAadhaar(aadhaar: string): string {
  return aadhaar.replace(/[\s-]/g, '');
}

/**
 * Format IFSC code (uppercase, no spaces)
 */
export function formatIFSC(ifsc: string): string {
  return ifsc.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Calculate onboarding progress percentage
 */
export function calculateProgress(stepsCompleted: {
  personalDetails: boolean;
  addressDetails: boolean;
  identityKYC: boolean;
  employmentDetails: boolean;
  compensationPayroll: boolean;
  statutoryTax: boolean;
  educationDetails: boolean;
  previousEmployment: boolean;
  emergencyContact: boolean;
  policiesDeclarations: boolean;
}): number {
  const totalSteps = 10;
  let completedSteps = 0;
  
  if (stepsCompleted.personalDetails) completedSteps++;
  if (stepsCompleted.addressDetails) completedSteps++;
  if (stepsCompleted.identityKYC) completedSteps++;
  if (stepsCompleted.employmentDetails) completedSteps++;
  if (stepsCompleted.compensationPayroll) completedSteps++;
  if (stepsCompleted.statutoryTax) completedSteps++;
  if (stepsCompleted.educationDetails) completedSteps++;
  if (stepsCompleted.previousEmployment) completedSteps++;
  if (stepsCompleted.emergencyContact) completedSteps++;
  if (stepsCompleted.policiesDeclarations) completedSteps++;
  
  return Math.round((completedSteps / totalSteps) * 100);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(expiryDate: Date): boolean {
  return new Date() > expiryDate;
}

/**
 * Generate onboarding link
 */
export function generateOnboardingLink(token: string, baseUrl: string = process.env.NEXTAUTH_URL || 'http://localhost:3000'): string {
  return `${baseUrl}/onboarding/${token}`;
}

/**
 * Validate file type for document uploads
 */
export function isValidDocumentType(fileName: string, allowedTypes: string[] = ['pdf', 'jpg', 'jpeg', 'png']): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension ? allowedTypes.includes(extension) : false;
}

/**
 * Get maximum file size in bytes (default: 5MB)
 */
export function getMaxFileSize(): number {
  return 5 * 1024 * 1024; // 5MB
}

/**
 * Validate file size
 */
export function isValidFileSize(fileSize: number, maxSize: number = getMaxFileSize()): boolean {
  return fileSize <= maxSize;
}
