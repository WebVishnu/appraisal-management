import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import OnboardingRequest from '@/lib/models/OnboardingRequest';
import OnboardingSubmission from '@/lib/models/OnboardingSubmission';
import OnboardingAudit from '@/lib/models/OnboardingAudit';
import { calculateProgress, validatePAN, validateAadhaar, validateIFSC, formatPAN, formatAadhaar, formatIFSC, isTokenExpired } from '@/lib/utils/onboarding';
import { z } from 'zod';
import mongoose from 'mongoose';

// POST - Submit onboarding (save step data)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await req.json();
    const { step, data, isFinalSubmit } = body;

    const request = await OnboardingRequest.findById(id);
    if (!request) {
      return NextResponse.json({ error: 'Onboarding request not found' }, { status: 404 });
    }

    // Check if token is expired
    if (isTokenExpired(request.tokenExpiry)) {
      return NextResponse.json(
        { error: 'Onboarding link has expired. Please contact HR for a new link.' },
        { status: 400 }
      );
    }

    let submission = await OnboardingSubmission.findOne({
      onboardingRequestId: request._id,
    });

    if (!submission) {
      submission = await OnboardingSubmission.create({
        onboardingRequestId: request._id,
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
        isDraft: true,
        lastSavedAt: new Date(),
      });
    }

    // Validate and update step data
    const validationErrors: Array<{ step: string; field: string; message: string }> = [];

    switch (step) {
      case 'personalDetails':
        if (!data.fullName || !data.dateOfBirth || !data.gender || !data.maritalStatus || !data.nationality || !data.personalEmail || !data.mobileNumber) {
          validationErrors.push({ step, field: 'required', message: 'All personal details fields are required' });
        }
        if (data.personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.personalEmail)) {
          validationErrors.push({ step, field: 'personalEmail', message: 'Invalid email address' });
        }
        if (validationErrors.length === 0) {
          // Convert dateOfBirth string to Date object
          const personalDetailsData = {
            ...data,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : new Date(),
          };
          submission.personalDetails = personalDetailsData;
          submission.stepsCompleted.personalDetails = true;
        }
        break;

      case 'addressDetails':
        if (!data.currentAddress) {
          validationErrors.push({ step, field: 'required', message: 'Current address is required' });
        }
        // Validate current address required fields
        if (data.currentAddress) {
          if (!data.currentAddress.line1 || !data.currentAddress.city || !data.currentAddress.state || !data.currentAddress.pincode) {
            validationErrors.push({ step, field: 'currentAddress', message: 'All current address fields (line1, city, state, pincode) are required' });
          }
        }
        if (validationErrors.length === 0) {
          // Ensure country is set for current address (default to 'India' if not provided)
          const currentAddress = {
            ...data.currentAddress,
            country: data.currentAddress?.country || 'India',
          };
          
          // If sameAsCurrent is true, copy current address to permanent address
          // Otherwise, use the provided permanentAddress or default to current address
          let permanentAddress;
          if (data.sameAsCurrent) {
            permanentAddress = { ...currentAddress };
          } else {
            // Validate permanent address if sameAsCurrent is false
            if (!data.permanentAddress || !data.permanentAddress.line1 || !data.permanentAddress.city || !data.permanentAddress.state || !data.permanentAddress.pincode) {
              validationErrors.push({ step, field: 'permanentAddress', message: 'All permanent address fields (line1, city, state, pincode) are required when not same as current address' });
            } else {
              permanentAddress = {
                ...data.permanentAddress,
                country: data.permanentAddress?.country || 'India',
              };
            }
          }
          
          if (validationErrors.length === 0) {
            const addressData = {
              currentAddress,
              permanentAddress,
              sameAsCurrent: data.sameAsCurrent || false,
            };
            submission.addressDetails = addressData;
            submission.stepsCompleted.addressDetails = true;
          }
        }
        break;

      case 'identityKYC':
        // Validate PAN if provided
        if (data.panNumber && !validatePAN(data.panNumber)) {
          validationErrors.push({ step, field: 'panNumber', message: 'Invalid PAN number format' });
        }
        // Validate Aadhaar if provided
        if (data.aadhaarNumber && !validateAadhaar(data.aadhaarNumber)) {
          validationErrors.push({ step, field: 'aadhaarNumber', message: 'Invalid Aadhaar number format' });
        }
        if (validationErrors.length === 0) {
          // Format PAN and Aadhaar
          if (data.panNumber) data.panNumber = formatPAN(data.panNumber);
          if (data.aadhaarNumber) data.aadhaarNumber = formatAadhaar(data.aadhaarNumber);
          submission.identityKYC = data;
          submission.stepsCompleted.identityKYC = true;
        }
        break;

      case 'employmentDetails':
        if (!data.dateOfJoining || !data.employmentType || !data.department || !data.designation || !data.workLocation) {
          validationErrors.push({ step, field: 'required', message: 'All employment details fields are required' });
        }
        if (validationErrors.length === 0) {
          // Convert dateOfJoining string to Date object
          const employmentData: any = {
            ...data,
            dateOfJoining: data.dateOfJoining ? new Date(data.dateOfJoining) : new Date(),
          };
          if (data.reportingManagerId) {
            employmentData.reportingManagerId = new mongoose.Types.ObjectId(data.reportingManagerId);
          }
          submission.employmentDetails = employmentData;
          submission.stepsCompleted.employmentDetails = true;
        }
        break;

      case 'compensationPayroll':
        if (!data.annualCTC || !data.basicSalary || !data.bankName || !data.accountNumber || !data.ifscCode || !data.payFrequency) {
          validationErrors.push({ step, field: 'required', message: 'All compensation and payroll fields are required' });
        }
        if (data.ifscCode && !validateIFSC(data.ifscCode)) {
          validationErrors.push({ step, field: 'ifscCode', message: 'Invalid IFSC code format' });
        }
        if (validationErrors.length === 0) {
          // Ensure all required fields are present with defaults
          const compensationData = {
            ...data,
            payFrequency: data.payFrequency || 'monthly', // Default to monthly if not provided
            pfApplicable: data.pfApplicable !== undefined ? data.pfApplicable : true,
            esiApplicable: data.esiApplicable !== undefined ? data.esiApplicable : false,
            hra: data.hra || 0,
            allowances: data.allowances || 0,
          };
          if (compensationData.ifscCode) {
            compensationData.ifscCode = formatIFSC(compensationData.ifscCode);
          }
          submission.compensationPayroll = compensationData;
          submission.stepsCompleted.compensationPayroll = true;
        }
        break;

      case 'statutoryTax':
        submission.statutoryTax = data;
        submission.stepsCompleted.statutoryTax = true;
        break;

      case 'educationDetails':
        // Ensure data is an array
        const educationArray = Array.isArray(data) ? data : [];
        
        if (educationArray.length === 0) {
          validationErrors.push({ step, field: 'required', message: 'At least one education detail is required' });
        } else {
          // Validate each education entry
          for (let i = 0; i < educationArray.length; i++) {
            const edu = educationArray[i];
            if (!edu.qualification || !edu.degree || !edu.institution || !edu.yearOfPassing) {
              validationErrors.push({ 
                step, 
                field: `educationDetails[${i}]`, 
                message: `Education entry ${i + 1}: All fields (qualification, degree, institution, year of passing) are required` 
              });
            }
          }
        }
        if (validationErrors.length === 0) {
          submission.educationDetails = educationArray;
          submission.stepsCompleted.educationDetails = true;
        }
        break;

      case 'previousEmployment':
        // Previous employment is optional, but if provided, validate
        if (data && Array.isArray(data)) {
          for (const emp of data) {
            if (!emp.companyName || !emp.designation || !emp.startDate || !emp.endDate) {
              validationErrors.push({ step, field: 'previousEmployment', message: 'All previous employment fields are required' });
              break;
            }
          }
        }
        if (validationErrors.length === 0) {
          // Convert date strings to Date objects
          const employmentList = (data || []).map((emp: any) => ({
            ...emp,
            startDate: emp.startDate ? new Date(emp.startDate) : new Date(),
            endDate: emp.endDate ? new Date(emp.endDate) : new Date(),
          }));
          submission.previousEmployment = employmentList;
          submission.stepsCompleted.previousEmployment = true;
        }
        break;

      case 'emergencyContact':
        if (!data.name || !data.relationship || !data.mobileNumber) {
          validationErrors.push({ step, field: 'required', message: 'All emergency contact fields are required' });
        }
        if (validationErrors.length === 0) {
          submission.emergencyContact = data;
          submission.stepsCompleted.emergencyContact = true;
        }
        break;

      case 'policiesDeclarations':
        if (!data.offerLetterAccepted || !data.ndaSigned || !data.codeOfConductAccepted || !data.poshPolicyAcknowledged || !data.dataPrivacyConsent) {
          validationErrors.push({ step, field: 'required', message: 'All policies and declarations must be accepted' });
        }
        if (validationErrors.length === 0) {
          // Set acceptance timestamps
          const now = new Date();
          data.offerLetterAcceptedAt = data.offerLetterAccepted ? now : null;
          data.ndaSignedAt = data.ndaSigned ? now : null;
          data.codeOfConductAcceptedAt = data.codeOfConductAccepted ? now : null;
          data.poshPolicyAcknowledgedAt = data.poshPolicyAcknowledged ? now : null;
          data.dataPrivacyConsentAt = data.dataPrivacyConsent ? now : null;
          submission.policiesDeclarations = data;
          submission.stepsCompleted.policiesDeclarations = true;
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
    }

    // Update progress
    const progress = calculateProgress(submission.stepsCompleted);
    request.progressPercentage = progress;

    // If final submit, validate all steps
    if (isFinalSubmit) {
      const allStepsCompleted = Object.values(submission.stepsCompleted).every((completed) => completed);
      if (!allStepsCompleted) {
        return NextResponse.json(
          { error: 'All steps must be completed before submission', validationErrors: submission.validationErrors },
          { status: 400 }
        );
      }

      if (validationErrors.length > 0) {
        submission.validationErrors = validationErrors;
        await submission.save();
        return NextResponse.json(
          { error: 'Validation errors found', validationErrors },
          { status: 400 }
        );
      }

      submission.isDraft = false;
      submission.submittedAt = new Date();
      request.status = 'submitted';
      request.submittedAt = new Date();

      // Create audit log
      await OnboardingAudit.create({
        onboardingRequestId: request._id,
        action: 'onboarding_submitted',
        performedBy: request.invitedBy, // System action
        performedAt: new Date(),
        description: 'Employee submitted onboarding for review',
      });
    } else {
      // Save as draft
      submission.lastSavedAt = new Date();
      if (validationErrors.length > 0) {
        submission.validationErrors = validationErrors;
      }
    }

    await submission.save();
    await request.save();

    // Create audit log for step completion
    if (!isFinalSubmit && validationErrors.length === 0) {
      await OnboardingAudit.create({
        onboardingRequestId: request._id,
        action: 'step_completed',
        performedBy: request.invitedBy,
        performedAt: new Date(),
        description: `Step "${step}" completed`,
        metadata: { step },
      });
    }

    return NextResponse.json({
      message: isFinalSubmit ? 'Onboarding submitted successfully' : 'Step saved successfully',
      submission,
      progress,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    });
  } catch (error) {
    console.error('Error submitting onboarding step:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
