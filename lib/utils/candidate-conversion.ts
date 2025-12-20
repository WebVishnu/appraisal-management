/**
 * Candidate to Employee Onboarding Conversion Utility
 * Handles the automated conversion from accepted offer to onboarding request
 */

import Candidate from '@/lib/models/Candidate';
import Offer from '@/lib/models/Offer';
import OnboardingRequest from '@/lib/models/OnboardingRequest';
import OnboardingSubmission from '@/lib/models/OnboardingSubmission';
import JobRequisition from '@/lib/models/JobRequisition';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import Interview from '@/lib/models/Interview';
import InterviewFeedback from '@/lib/models/InterviewFeedback';
import { generateOnboardingId, generateOnboardingToken, generateOnboardingLink } from './onboarding';
import InterviewAuditLog from '@/lib/models/InterviewAuditLog';
import bcrypt from 'bcryptjs';

/**
 * Convert candidate to onboarding request when offer is accepted
 */
export async function convertCandidateToOnboarding(
  candidate: any,
  offer: any
): Promise<{ onboardingRequest: any; onboardingSubmission?: any; employee?: any; user?: any }> {
  try {
    // Get job requisition details
    const jobRequisition = await JobRequisition.findById(candidate.jobRequisitionId);
    if (!jobRequisition) {
      throw new Error('Job requisition not found');
    }

    // Check if onboarding request already exists
    let onboardingRequest = await OnboardingRequest.findOne({
      email: candidate.email.toLowerCase(),
      status: { $in: ['invited', 'in_progress', 'submitted', 'changes_requested'] },
    });

    if (onboardingRequest) {
      // Fetch interviews to get location if needed
      const existingInterviews = await Interview.find({ candidateId: candidate._id })
        .sort({ roundOrder: 1, scheduledStartTime: 1 });
      
      const finalWorkLocationForUpdate = offer.location || 
                                         (existingInterviews.find(i => i.mode === 'in_person' && i.location)?.location) || 
                                         jobRequisition.location || 
                                         '';

      // Update existing onboarding request
      onboardingRequest.firstName = candidate.firstName;
      onboardingRequest.lastName = candidate.lastName;
      onboardingRequest.dateOfJoining = offer.startDate || jobRequisition.expectedStartDate || new Date();
      onboardingRequest.department = offer.department || jobRequisition.department;
      onboardingRequest.designation = offer.jobTitle || jobRequisition.jobTitle;
      onboardingRequest.reportingManagerId = jobRequisition.hiringManagerId;
      onboardingRequest.workLocation = finalWorkLocationForUpdate;
      onboardingRequest.status = 'invited';
      onboardingRequest.progressPercentage = 0;
      onboardingRequest.invitedAt = new Date();
      
      // Regenerate token if expired
      if (onboardingRequest.tokenExpiry && new Date() > onboardingRequest.tokenExpiry) {
        onboardingRequest.token = generateOnboardingToken();
        onboardingRequest.tokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      }

      await onboardingRequest.save();
    } else {
      // Create new onboarding request
      const currentYear = new Date().getFullYear();
      const count = await OnboardingRequest.countDocuments({
        onboardingId: new RegExp(`^ONB-${currentYear}-`),
      });
      const onboardingId = generateOnboardingId(currentYear, count + 1);
      const token = generateOnboardingToken();
      const tokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Fetch interviews to get location if needed
      const interviews = await Interview.find({ candidateId: candidate._id })
        .sort({ roundOrder: 1, scheduledStartTime: 1 });

      // Extract work location from offer, interview, or job requisition (in priority order)
      const finalWorkLocationForRequest = offer.location || 
                                         (interviews.find(i => i.mode === 'in_person' && i.location)?.location) || 
                                         jobRequisition.location || 
                                         '';

      onboardingRequest = await OnboardingRequest.create({
        onboardingId,
        token,
        tokenExpiry,
        email: candidate.email.toLowerCase(),
        personalEmail: candidate.email.toLowerCase(), // Can be updated later
        mobileNumber: candidate.phoneNumber,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        dateOfJoining: offer.startDate || jobRequisition.expectedStartDate || new Date(),
        department: offer.department || jobRequisition.department,
        designation: offer.jobTitle || jobRequisition.jobTitle,
        reportingManagerId: jobRequisition.hiringManagerId,
        workLocation: finalWorkLocationForRequest,
        status: 'invited',
        progressPercentage: 0,
        invitedAt: new Date(),
        invitedBy: offer.createdBy, // HR who created the offer
        reminderCount: 0,
      });
    }

    // Update candidate record
    candidate.status = 'selected';
    candidate.onboardingRequestId = onboardingRequest._id;
    candidate.lastActivityAt = new Date();
    await candidate.save();

    // Update offer record
    offer.convertedToOnboardingRequestId = onboardingRequest._id;
    offer.convertedAt = new Date();
    await offer.save();

    // Fetch additional data from interviews and feedback
    const interviews = await Interview.find({ candidateId: candidate._id })
      .populate('primaryInterviewerId', 'email')
      .sort({ roundOrder: 1, scheduledStartTime: 1 });
    
    const interviewFeedbacks = await InterviewFeedback.find({ candidateId: candidate._id })
      .populate('interviewerId', 'email')
      .sort({ roundOrder: 1, submittedAt: 1 });

    // Extract work location from interviews (if in-person interviews were conducted)
    const interviewLocation = interviews.find(i => i.mode === 'in_person' && i.location)?.location;
    
    // Use interview location if offer location is not available
    const finalWorkLocation = offer.location || interviewLocation || jobRequisition.location || '';

    // Create pre-filled onboarding submission with all available data
    let onboardingSubmission = await OnboardingSubmission.findOne({
      onboardingRequestId: onboardingRequest._id,
    });

    if (!onboardingSubmission) {
      // ============================================
      // COMPREHENSIVE AUTO-FILL FROM ALL SOURCES
      // ============================================
      // Data sources used (in priority order):
      // 1. Offer: Compensation breakdown, employment details, dates, location
      // 2. Job Requisition: Department, job title, hiring manager, expected start date, location
      // 3. Interviews: Work location (from in-person interviews)
      // 4. Candidate: Personal info, previous employment, experience, notice period
      // 5. Interview Feedback: (Available but not directly mapped to onboarding fields)
      // ============================================
      
      // Calculate allowances: Sum of ALL compensation components from offer
      // This includes: LTA, Medical Allowance, Special Allowance, Performance Bonus, Other Benefits
      // All these details from the "Create Offer" section are being reused here
      const allowances = (offer.compensation.lta || 0) + 
                        (offer.compensation.medicalAllowance || 0) + 
                        (offer.compensation.specialAllowance || 0) +
                        (offer.compensation.performanceBonus || 0) +
                        (offer.compensation.otherBenefits || 0);

      // Map employment type (offer has more options than onboarding)
      let employmentType: 'full_time' | 'contract' | 'intern' = 'full_time';
      if (offer.employmentType === 'contract') {
        employmentType = 'contract';
      } else if (offer.employmentType === 'intern') {
        employmentType = 'intern';
      }

      // Calculate probation status and period
      const probationStatus = (offer.probationPeriod && offer.probationPeriod > 0) || false;
      const probationPeriodMonths = offer.probationPeriod 
        ? Math.round(offer.probationPeriod / 30) // Convert days to months (approximate)
        : undefined;

      onboardingSubmission = await OnboardingSubmission.create({
        onboardingRequestId: onboardingRequest._id,
        isDraft: true,
        lastSavedAt: new Date(),
        stepsCompleted: {
          personalDetails: false,
          addressDetails: false,
          identityKYC: false,
          employmentDetails: false,
          compensationPayroll: false,
          statutoryTax: false,
          educationDetails: false,
          previousEmployment: false,
          emergencyContact: false,
          policiesDeclarations: false,
        },
        // Pre-fill Personal Details (only fields we have)
        // Note: dateOfBirth, gender, maritalStatus, nationality are required but not available
        // So we'll set them to defaults that employee must update
        personalDetails: {
          fullName: `${candidate.firstName} ${candidate.lastName}`,
          dateOfBirth: new Date('1990-01-01'), // Placeholder date, employee MUST update
          gender: 'prefer_not_to_say', // Default, employee MUST update
          maritalStatus: 'single', // Default, employee MUST update
          nationality: 'Indian', // Default for Indian companies, employee can update
          personalEmail: candidate.email.toLowerCase(),
          mobileNumber: candidate.phoneNumber || candidate.alternatePhoneNumber || '',
          photographUrl: undefined, // Employee will upload
        },
        // Address Details - Not available from candidate/offer, employee will fill
        addressDetails: undefined,
        // Identity KYC - Not available, employee will fill
        identityKYC: undefined,
        // Pre-fill Employment Details
        employmentDetails: {
          dateOfJoining: offer.startDate || jobRequisition.expectedStartDate || new Date(),
          employmentType: employmentType,
          department: offer.department || jobRequisition.department,
          designation: offer.jobTitle || jobRequisition.jobTitle,
          reportingManagerId: jobRequisition.hiringManagerId || undefined,
          workLocation: finalWorkLocation,
          probationStatus: probationStatus,
          probationPeriodMonths: probationPeriodMonths,
        },
        // Pre-fill Compensation & Payroll with detailed breakdown
        compensationPayroll: {
          annualCTC: offer.compensation.annualCTC,
          basicSalary: offer.compensation.basicSalary,
          hra: offer.compensation.hra,
          // Sum of all allowances (LTA, Medical, Special, Performance Bonus, Other Benefits)
          allowances: allowances,
          payFrequency: 'monthly', // Default, can be updated if needed
          pfApplicable: true, // Default for Indian companies
          esiApplicable: offer.compensation.annualCTC < 21000, // ESI applicable if CTC < 21k
          bankName: '', // Employee will fill
          accountNumber: '', // Employee will fill
          ifscCode: '', // Employee will fill
          bankProofUrl: undefined, // Employee will upload
        },
        // Statutory Tax - Defaults, employee will update
        statutoryTax: {
          professionalTaxApplicable: true, // Default for Indian companies
          incomeTaxRegime: 'old', // Default, employee can choose
        },
        // Education Details - Not available, employee will fill
        educationDetails: [],
        // Previous Employment - Map from candidate if available
        // Calculate approximate dates based on total experience and notice period
        previousEmployment: candidate.currentCompany ? [{
          companyName: candidate.currentCompany,
          designation: candidate.currentDesignation || 'Previous Role',
          // Calculate start date: current date - total experience - notice period
          startDate: (() => {
            const totalExpYears = candidate.totalExperience || 1;
            const noticePeriodDays = candidate.noticePeriod || 0;
            const totalDays = totalExpYears * 365 + noticePeriodDays;
            return new Date(Date.now() - totalDays * 24 * 60 * 60 * 1000);
          })(),
          // End date: current date - notice period (assuming they're serving notice)
          endDate: (() => {
            const noticePeriodDays = candidate.noticePeriod || 0;
            return new Date(Date.now() - noticePeriodDays * 24 * 60 * 60 * 1000);
          })(),
          reasonForLeaving: 'Joining new opportunity', // Default, employee will update
        }] : [],
        // Emergency Contact - Not available, employee will fill
        emergencyContact: undefined,
        // Policies Declarations - Defaults, employee will accept
        policiesDeclarations: {
          offerLetterAccepted: false, // Employee needs to accept
          ndaSigned: false, // Employee needs to sign
          codeOfConductAccepted: false, // Employee needs to accept
          poshPolicyAcknowledged: false, // Employee needs to acknowledge
          dataPrivacyConsent: false, // Employee needs to consent
        },
      });
    }

    // Create audit log
    await InterviewAuditLog.create({
      candidateId: candidate._id,
      offerId: offer._id,
      onboardingRequestId: onboardingRequest._id,
      jobRequisitionId: candidate.jobRequisitionId,
      action: 'onboarding_converted',
      actionDescription: `Candidate converted to onboarding request ${onboardingRequest.onboardingId} with pre-filled submission data`,
      performedByRole: 'system',
      timestamp: new Date(),
    });

    // Note: Employee and User records are created later when onboarding is approved
    // This happens in the onboarding approval flow

    return { onboardingRequest, onboardingSubmission };
  } catch (error) {
    console.error('Error converting candidate to onboarding:', error);
    throw error;
  }
}

/**
 * Create employee and user records after onboarding approval
 * This is called from the onboarding approval API
 */
export async function createEmployeeFromOnboarding(
  onboardingRequest: any,
  candidate?: any
): Promise<{ employee: any; user: any }> {
  try {
    // Generate employee ID
    const currentYear = new Date().getFullYear();
    const count = await Employee.countDocuments({
      employeeId: new RegExp(`^EMP-${currentYear}-`),
    });
    const employeeId = `EMP-${currentYear}-${String(count + 1).padStart(4, '0')}`;

    // Create employee record
    const employee = await Employee.create({
      employeeId,
      name: `${onboardingRequest.firstName} ${onboardingRequest.lastName}`,
      email: onboardingRequest.email.toLowerCase(),
      role: onboardingRequest.designation || 'Employee',
      managerId: onboardingRequest.reportingManagerId || null,
      isActive: true,
    });

    // Generate random password
    const defaultPassword = Math.floor(1000000 + Math.random() * 9000000).toString();
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Create user account
    const user = await User.create({
      email: onboardingRequest.email.toLowerCase(),
      password: hashedPassword,
      role: 'employee',
      employeeId: employee._id,
      isActive: true,
    });

    // Update onboarding request
    onboardingRequest.employeeId = employee._id;
    onboardingRequest.userId = user._id;
    onboardingRequest.status = 'completed';
    onboardingRequest.completedAt = new Date();
    await onboardingRequest.save();

    // Update candidate if exists
    if (candidate) {
      candidate.convertedToEmployeeId = employee._id;
      candidate.convertedAt = new Date();
      await candidate.save();
    }

    // Update job requisition positions filled
    if (candidate?.jobRequisitionId) {
      const JobRequisition = (await import('@/lib/models/JobRequisition')).default;
      await JobRequisition.findByIdAndUpdate(candidate.jobRequisitionId, {
        $inc: { positionsFilled: 1 },
      });
    }

    return { employee, user };
  } catch (error) {
    console.error('Error creating employee from onboarding:', error);
    throw error;
  }
}

/**
 * Map candidate data to onboarding form fields
 * Used to pre-fill onboarding forms
 */
export function mapCandidateToOnboardingData(candidate: any, offer: any, jobRequisition: any) {
  return {
    personalDetails: {
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phoneNumber: candidate.phoneNumber,
      alternatePhoneNumber: candidate.alternatePhoneNumber,
    },
    employmentDetails: {
      dateOfJoining: offer.startDate,
      department: offer.department || jobRequisition.department,
      designation: offer.jobTitle,
      reportingManager: jobRequisition.hiringManagerId,
      workLocation: offer.location,
      employmentType: offer.employmentType,
    },
    compensation: {
      annualCTC: offer.compensation.annualCTC,
      basicSalary: offer.compensation.basicSalary,
      hra: offer.compensation.hra,
      specialAllowance: offer.compensation.specialAllowance,
      // ... other compensation fields
    },
    // Additional fields can be mapped as needed
  };
}

