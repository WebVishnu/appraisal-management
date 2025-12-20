'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Upload,
  FileText,
  User,
  MapPin,
  CreditCard,
  GraduationCap,
  Briefcase,
  Phone,
  Shield,
  Save,
  Send,
  DollarSign,
  Edit,
} from 'lucide-react';
import { formatErrorMessage, formatDate } from '@/lib/utils/format';
import { validatePAN, validateAadhaar, validateIFSC, formatPAN, formatAadhaar, formatIFSC } from '@/lib/utils/onboarding';
import { SkeletonCard } from '@/components/shared/skeleton-loader';

interface OnboardingRequest {
  _id: string;
  onboardingId: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfJoining: string;
  department?: string;
  designation?: string;
  workLocation?: string;
  reportingManagerId?: {
    _id: string;
    name: string;
    employeeId: string;
  };
  status: string;
  progressPercentage: number;
  tokenExpiry: string;
  changeRequestComments?: string;
  rejectionReason?: string;
  submittedAt?: string;
  approvedAt?: string;
}

interface OnboardingSubmission {
  _id: string;
  stepsCompleted: {
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
  };
  personalDetails?: any;
  addressDetails?: any;
  identityKYC?: any;
  employmentDetails?: any;
  compensationPayroll?: any;
  statutoryTax?: any;
  educationDetails?: any[];
  previousEmployment?: any[];
  emergencyContact?: any;
  policiesDeclarations?: any;
  isDraft: boolean;
}

const STEPS = [
  { id: 'personalDetails', title: 'Personal Details', icon: User },
  { id: 'addressDetails', title: 'Address Details', icon: MapPin },
  { id: 'identityKYC', title: 'Identity & KYC', icon: CreditCard },
  { id: 'employmentDetails', title: 'Employment Details', icon: Briefcase },
  { id: 'compensationPayroll', title: 'Compensation & Payroll', icon: DollarSign },
  { id: 'statutoryTax', title: 'Statutory & Tax', icon: FileText },
  { id: 'educationDetails', title: 'Education Details', icon: GraduationCap },
  { id: 'previousEmployment', title: 'Previous Employment', icon: Briefcase },
  { id: 'emergencyContact', title: 'Emergency Contact', icon: Phone },
  { id: 'policiesDeclarations', title: 'Policies & Declarations', icon: Shield },
];

export default function OnboardingFormClient() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [request, setRequest] = useState<OnboardingRequest | null>(null);
  const [submission, setSubmission] = useState<OnboardingSubmission | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<any>({});
  const [isHRView, setIsHRView] = useState(false);
  const [isManagerView, setIsManagerView] = useState(false);
  const [isHREditMode, setIsHREditMode] = useState(false);

  useEffect(() => {
    if (token) {
      fetchOnboardingData();
    }
  }, [token]);

  // Re-fetch when session changes
  useEffect(() => {
    if (session && token) {
      fetchOnboardingData();
    }
  }, [session]);

  const fetchOnboardingData = async () => {
    try {
      const response = await fetch(`/api/onboarding/token/${token}`);
      if (response.ok) {
        const data = await response.json();
        setRequest(data.request);
        setSubmission(data.submission);
        
        // Check if HR or Manager is viewing
        const isHR = session?.user?.role === 'hr' || session?.user?.role === 'super_admin';
        const isManager = session?.user?.role === 'manager';
        setIsHRView(isHR || isManager); // Both HR and managers can view
        
        // HR can edit if status is 'submitted' and not 'changes_requested'
        // Managers can only view (read-only)
        // Don't auto-enable edit mode, let HR toggle it
        if (isHR) {
          if (data.request.status === 'changes_requested') {
            setIsHREditMode(false); // Disable edit mode if changes are requested
          } else if (data.request.status === 'submitted') {
            // Allow HR to enable edit mode for submitted requests
            setIsHREditMode(false); // Start with edit mode disabled, HR can enable it
          } else {
            setIsHREditMode(false); // Disable for other statuses
          }
        } else if (isManager) {
          // Managers can only view, never edit
          setIsHREditMode(false);
        }
        
        // Initialize form data from submission and merge with request data
        if (data.submission) {
          // Merge employment details with request data (for pre-filled values)
          const employmentDetails = data.submission.employmentDetails || {};
          const mergedEmploymentDetails = {
            ...employmentDetails,
            // Include request data if not already in submission
            dateOfJoining: employmentDetails.dateOfJoining || data.request.dateOfJoining,
            department: employmentDetails.department || data.request.department || '',
            designation: employmentDetails.designation || data.request.designation || '',
            workLocation: employmentDetails.workLocation || data.request.workLocation || '',
            reportingManagerId: employmentDetails.reportingManagerId || data.request.reportingManagerId?._id || data.request.reportingManagerId || null,
          };

          // Merge personal details with request data (auto-fill if not already filled)
          const personalDetails = data.submission.personalDetails || {};
          const mergedPersonalDetails = {
            ...personalDetails,
            // Auto-fill from request if not already in submission
            fullName: personalDetails.fullName || (data.request.firstName && data.request.lastName 
              ? `${data.request.firstName} ${data.request.lastName}`.trim()
              : ''),
            mobileNumber: personalDetails.mobileNumber || data.request.mobileNumber || '',
            personalEmail: personalDetails.personalEmail || data.request.personalEmail || data.request.email || '',
          };

          setFormData({
            personalDetails: mergedPersonalDetails,
            addressDetails: data.submission.addressDetails || {},
            identityKYC: data.submission.identityKYC || {},
            employmentDetails: mergedEmploymentDetails,
            compensationPayroll: data.submission.compensationPayroll || {},
            statutoryTax: data.submission.statutoryTax || {},
            educationDetails: Array.isArray(data.submission.educationDetails) ? data.submission.educationDetails : [],
            previousEmployment: Array.isArray(data.submission.previousEmployment) ? data.submission.previousEmployment : [],
            emergencyContact: data.submission.emergencyContact || {},
            policiesDeclarations: data.submission.policiesDeclarations || {},
          });
        } else if (data.request) {
          // If no submission exists yet, initialize with request data and auto-fill available fields
          setFormData({
            personalDetails: {
              // Auto-fill from request if available
              fullName: data.request.firstName && data.request.lastName 
                ? `${data.request.firstName} ${data.request.lastName}`.trim()
                : '',
              mobileNumber: data.request.mobileNumber || '',
              personalEmail: data.request.personalEmail || data.request.email || '',
            },
            addressDetails: {},
            identityKYC: {},
            employmentDetails: {
              dateOfJoining: data.request.dateOfJoining,
              department: data.request.department || '',
              designation: data.request.designation || '',
              workLocation: data.request.workLocation || '',
              reportingManagerId: data.request.reportingManagerId?._id || data.request.reportingManagerId || null,
            },
            compensationPayroll: {},
            statutoryTax: {},
            educationDetails: [{ qualification: '', degree: '', institution: '', yearOfPassing: new Date().getFullYear() }],
            previousEmployment: [],
            emergencyContact: {},
            policiesDeclarations: {},
          });
        }
      } else {
        const error = await response.json();
        toast.error(formatErrorMessage(error.error, 'Failed to load onboarding'));
        router.push('/login');
      }
    } catch (error) {
      console.error('Error fetching onboarding data:', error);
      toast.error('Failed to load onboarding');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStep = async (stepId: string, isFinalSubmit: boolean = false): Promise<boolean> => {
    if (!request) return false;

    setSaving(true);
    try {
      let stepData = formData[stepId];
      
      // For employmentDetails, merge with request data to ensure pre-filled values are included
      if (stepId === 'employmentDetails') {
        stepData = {
          ...stepData,
          // Ensure all required fields are present, using request data as fallback
          dateOfJoining: stepData.dateOfJoining || request?.dateOfJoining,
          department: stepData.department || request?.department || '',
          designation: stepData.designation || request?.designation || '',
          workLocation: stepData.workLocation || request?.workLocation || '',
          reportingManagerId: stepData.reportingManagerId || request?.reportingManagerId?._id || request?.reportingManagerId || null,
          // Preserve other fields
          employmentType: stepData.employmentType || '',
          probationStatus: stepData.probationStatus || false,
          probationPeriodMonths: stepData.probationPeriodMonths || undefined,
        };
      }
      
      // For compensationPayroll, ensure payFrequency has a default value
      if (stepId === 'compensationPayroll') {
        stepData = {
          ...stepData,
          payFrequency: stepData.payFrequency || 'monthly',
          pfApplicable: stepData.pfApplicable !== undefined ? stepData.pfApplicable : true,
          esiApplicable: stepData.esiApplicable !== undefined ? stepData.esiApplicable : false,
        };
      }
      
      // For array-based steps, ensure we're sending the array directly
      if (stepId === 'educationDetails' || stepId === 'previousEmployment') {
        stepData = Array.isArray(stepData) ? stepData : (stepData || []);
        
        // For educationDetails, filter out completely empty entries before saving
        if (stepId === 'educationDetails' && Array.isArray(stepData)) {
          stepData = stepData.filter((edu: any) => 
            edu.qualification || edu.degree || edu.institution || edu.yearOfPassing
          );
        }
      }
      
      // Managers cannot save - they are read-only
      if (isManagerView) {
        toast.error('Managers have read-only access. Contact HR to request changes.');
        return false;
      }

      // Use HR update endpoint if HR is editing, otherwise use employee submit endpoint
      const endpoint = isHREditMode 
        ? `/api/onboarding/${request._id}/hr-update`
        : `/api/onboarding/${request._id}/submit`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: stepId,
          data: stepData,
          ...(isHREditMode ? {} : { isFinalSubmit }),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.validationErrors && data.validationErrors.length > 0) {
          // Show validation errors
          const errorMessages = data.validationErrors.map((err: any) => err.message).join(', ');
          toast.error(`Validation errors: ${errorMessages}`);
          return false; // Return false to indicate error
        }

        if (isHREditMode) {
          toast.success('Changes saved successfully');
          // Update local state
          if (data.submission) {
            setSubmission(data.submission);
            setRequest({ ...request, progressPercentage: data.progress || request.progressPercentage });
          }
        } else if (isFinalSubmit) {
          toast.success('Onboarding submitted successfully! HR will review your submission.');
          // Refresh data
          fetchOnboardingData();
        } else {
          toast.success('Step saved successfully');
          // Update local state
          if (data.submission) {
            setSubmission(data.submission);
            setRequest({ ...request, progressPercentage: data.progress });
          }
        }
        return true; // Return true to indicate success
      } else {
        const errorMsg = data.error || 'Failed to save step';
        const validationErrors = data.validationErrors || [];
        if (validationErrors.length > 0) {
          const errorMessages = validationErrors.map((err: any) => err.message).join(', ');
          toast.error(`Validation errors: ${errorMessages}`);
        } else {
          toast.error(formatErrorMessage(errorMsg, 'Failed to save step'));
        }
        return false; // Return false to indicate error
      }
    } catch (error: any) {
      console.error('Error saving step:', error);
      toast.error(formatErrorMessage(error, 'Failed to save step'));
      return false; // Return false to indicate error
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    // For managers and HR in view mode, allow navigation without saving
    if (isManagerView || (isHRView && !isHREditMode)) {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      }
      return;
    }
    
    // For employees and HR in edit mode, save before moving to next step
    const currentStepId = STEPS[currentStep].id;
    const success = await handleSaveStep(currentStepId, false);
    // Only move to next step if save was successful and no validation errors
    if (success && currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    const currentStepId = STEPS[currentStep].id;
    await handleSaveStep(currentStepId, true);
  };

  const handleRequestChanges = async () => {
    if (!request) return;
    
    const comments = prompt('Please enter the changes you would like the employee to make:');
    if (!comments || comments.trim() === '') {
      return;
    }

    try {
      const response = await fetch(`/api/onboarding/${request._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_changes',
          changeRequestComments: comments.trim(),
        }),
      });

      if (response.ok) {
        toast.success('Changes requested successfully');
        setIsHREditMode(false);
        fetchOnboardingData();
      } else {
        const error = await response.json();
        toast.error(formatErrorMessage(error.error, 'Failed to request changes'));
      }
    } catch (error: any) {
      console.error('Error requesting changes:', error);
      toast.error('Failed to request changes');
    }
  };

  const updateFormData = (stepId: string, fieldOrData: string | object, value?: any) => {
    if (typeof fieldOrData === 'object') {
      // Direct update of entire step data
      setFormData({
        ...formData,
        [stepId]: fieldOrData,
      });
    } else {
      // Update specific field
      setFormData({
        ...formData,
        [stepId]: {
          ...(formData[stepId] || {}),
          [fieldOrData]: value,
        },
      });
    }
  };

  if (loading) {
    return <SkeletonCard />;
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <h2 className="text-xl font-bold mb-2">Invalid Onboarding Link</h2>
              <p className="text-muted-foreground">This onboarding link is invalid or has expired.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if onboarding is already submitted or completed (non-editable statuses)
  // HR can always view and edit submitted requests, so exclude 'submitted' for HR
  const nonEditableStatuses = isHRView 
    ? ['approved', 'rejected', 'completed'] 
    : ['submitted', 'approved', 'rejected', 'completed'];
  const isEditable = !nonEditableStatuses.includes(request.status);

  // If not editable, show message instead of form
  // But HR can always view submitted requests, so allow them through
  if (!isEditable && !(isHRView && request.status === 'submitted')) {
    const getStatusMessage = () => {
      switch (request.status) {
        case 'submitted':
          return {
            title: 'Onboarding Submitted',
            message: 'Your onboarding has been submitted successfully. HR will review your submission and get back to you soon.',
            icon: Check,
            color: 'text-blue-600 dark:text-blue-400',
            bgColor: 'bg-blue-50 dark:bg-blue-900/20',
            borderColor: 'border-blue-200 dark:border-blue-800',
          };
        case 'approved':
          return {
            title: 'Onboarding Approved',
            message: 'Congratulations! Your onboarding has been approved by HR. Your account will be activated soon.',
            icon: Check,
            color: 'text-green-600 dark:text-green-400',
            bgColor: 'bg-green-50 dark:bg-green-900/20',
            borderColor: 'border-green-200 dark:border-green-800',
          };
        case 'rejected':
          return {
            title: 'Onboarding Rejected',
            message: request.rejectionReason 
              ? `Your onboarding has been rejected. Reason: ${request.rejectionReason}`
              : 'Your onboarding has been rejected. Please contact HR for more information.',
            icon: AlertCircle,
            color: 'text-red-600 dark:text-red-400',
            bgColor: 'bg-red-50 dark:bg-red-900/20',
            borderColor: 'border-red-200 dark:border-red-800',
          };
        case 'completed':
          return {
            title: 'Onboarding Completed',
            message: 'Your onboarding process has been completed. Your account is now active.',
            icon: Check,
            color: 'text-green-600 dark:text-green-400',
            bgColor: 'bg-green-50 dark:bg-green-900/20',
            borderColor: 'border-green-200 dark:border-green-800',
          };
        default:
          return {
            title: 'Onboarding Status',
            message: 'Your onboarding is currently being processed.',
            icon: AlertCircle,
            color: 'text-gray-600 dark:text-gray-400',
            bgColor: 'bg-gray-50 dark:bg-gray-900/20',
            borderColor: 'border-gray-200 dark:border-gray-800',
          };
      }
    };

    const statusInfo = getStatusMessage();
    const StatusIcon = statusInfo.icon;

    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-6 w-6" />
              Employee Onboarding
            </CardTitle>
            <CardDescription>
              Onboarding ID: {request.onboardingId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`p-6 rounded-lg border ${statusInfo.bgColor} ${statusInfo.borderColor}`}>
              <div className="flex items-start gap-4">
                <StatusIcon className={`h-8 w-8 ${statusInfo.color} flex-shrink-0 mt-1`} />
                <div className="flex-1">
                  <h3 className={`text-xl font-semibold mb-2 ${statusInfo.color}`}>
                    {statusInfo.title}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    {statusInfo.message}
                  </p>
                  {request.status === 'submitted' && request.submittedAt && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Submitted on: {formatDate(request.submittedAt)}
                    </p>
                  )}
                  {request.status === 'approved' && request.approvedAt && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Approved on: {formatDate(request.approvedAt)}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {request.status === 'rejected' && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => router.push('/login')}
                >
                  Contact HR
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStepData = STEPS[currentStep];
  const progress = request.progressPercentage || 0;
  const isStepCompleted = submission?.stepsCompleted[currentStepData.id as keyof typeof submission.stepsCompleted] || false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {isHRView 
                    ? 'Onboarding Review' 
                    : isManagerView 
                    ? 'Team Member Onboarding' 
                    : 'Employee Onboarding'}
                  {isHRView && (
                    <Badge variant="outline">
                      HR View
                    </Badge>
                  )}
                  {isManagerView && (
                    <Badge variant="outline">
                      Manager View (Read-Only)
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isHRView 
                    ? `Reviewing onboarding for ${request.firstName} ${request.lastName} (${request.email})`
                    : isManagerView
                    ? `Viewing onboarding for ${request.firstName} ${request.lastName} (${request.email}) - Read Only`
                    : `Welcome ${request.firstName}! Please complete all steps to finish your onboarding.`}
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Onboarding ID</p>
                <p className="font-mono text-sm">{request.onboardingId}</p>
              </div>
            </div>
            {/* HR Controls - Only show for HR, not managers */}
            {isHRView && request.status === 'submitted' && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-blue-900 dark:text-blue-100">HR Review Mode</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {isHREditMode 
                        ? 'You can edit the submission directly. Changes will be saved immediately. Use Previous/Next buttons to navigate through all sections.'
                        : 'You can review the submission. Use Previous/Next buttons to navigate through all sections. Click "Enable Edit Mode" to make changes, or "Request Changes" to ask the employee to update specific fields.'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={isHREditMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIsHREditMode(!isHREditMode)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      {isHREditMode ? 'Disable Edit' : 'Enable Edit Mode'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRequestChanges}
                    >
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Request Changes
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Manager View Notice */}
            {isManagerView && request.status === 'submitted' && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-100">Manager View (Read-Only)</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      You are viewing your team member's onboarding submission. This is a read-only view. Contact HR if you need to request changes.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {/* HR View - Changes Requested Warning */}
            {isHRView && request.status === 'changes_requested' && (
              <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-900 dark:text-orange-100">Changes Requested</p>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                      Changes have been requested from the employee. Editing is disabled until the employee resubmits.
                    </p>
                    {request.changeRequestComments && (
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
                        Comments: {request.changeRequestComments}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Manager View - Changes Requested Info */}
            {isManagerView && request.status === 'changes_requested' && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-100">Changes Requested</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      HR has requested changes from the employee. The employee will resubmit after making the requested changes.
                    </p>
                    {request.changeRequestComments && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                        HR Comments: {request.changeRequestComments}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardHeader>
          <CardContent>
            {/* Step Indicator */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = index === currentStep;
                  const isCompleted = submission?.stepsCompleted[step.id as keyof typeof submission.stepsCompleted] || false;
                  
                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                            isActive
                              ? 'border-primary bg-primary text-primary-foreground'
                              : isCompleted
                              ? 'border-green-500 bg-green-500 text-white'
                              : 'border-gray-300 bg-white text-gray-400'
                          }`}
                        >
                          {isCompleted ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            <StepIcon className="h-5 w-5" />
                          )}
                        </div>
                        <span className={`text-xs mt-2 text-center ${isActive ? 'font-semibold' : 'text-muted-foreground'}`}>
                          {step.title}
                        </span>
                      </div>
                      {index < STEPS.length - 1 && (
                        <div
                          className={`h-0.5 flex-1 mx-2 ${
                            isCompleted ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Change Request Comments */}
            {request.changeRequestComments && (
              <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-900 dark:text-orange-100">Changes Requested</p>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                      {request.changeRequestComments}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step Content */}
            <div className="mb-6">
              {renderStepContent(
                currentStepData.id,
                (() => {
                  let stepData = formData[currentStepData.id];
                  
                  // For employmentDetails, merge with request data to show pre-filled values
                  if (currentStepData.id === 'employmentDetails' && request) {
                    stepData = {
                      ...stepData,
                      dateOfJoining: stepData?.dateOfJoining || request.dateOfJoining,
                      department: stepData?.department || request.department || '',
                      designation: stepData?.designation || request.designation || '',
                      workLocation: stepData?.workLocation || request.workLocation || '',
                      reportingManagerId: stepData?.reportingManagerId || request.reportingManagerId?._id || request.reportingManagerId || null,
                    };
                  }
                  
                  return stepData !== undefined ? stepData : 
                    (currentStepData.id === 'educationDetails' || currentStepData.id === 'previousEmployment' ? [] : {});
                })()
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex gap-2">
                {/* Manager View - Show navigation buttons and back to dashboard */}
                {isManagerView ? (
                  <>
                    {currentStep < STEPS.length - 1 ? (
                      <Button onClick={handleNext} disabled={saving}>
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => router.push('/dashboard/manager')}
                      >
                        Back to Dashboard
                      </Button>
                    )}
                  </>
                ) : isHRView && isHREditMode ? (
                  /* HR Edit Mode - Show save and back buttons */
                  <>
                    <Button
                      variant="default"
                      onClick={() => handleSaveStep(currentStepData.id, false)}
                      disabled={saving}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push('/dashboard/hr')}
                    >
                      Back to Dashboard
                    </Button>
                  </>
                ) : isHRView && !isHREditMode ? (
                  /* HR View Mode (not editing) - Show navigation and back button */
                  <>
                    {currentStep < STEPS.length - 1 ? (
                      <Button onClick={handleNext} disabled={saving}>
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => router.push('/dashboard/hr')}
                      >
                        Back to Dashboard
                      </Button>
                    )}
                  </>
                ) : (
                  /* Employee View - Show save, next/submit buttons */
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleSaveStep(currentStepData.id, false)}
                      disabled={saving}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save Draft
                    </Button>
                    {currentStep < STEPS.length - 1 ? (
                      <Button onClick={handleNext} disabled={saving}>
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    ) : (
                      <Button onClick={handleSubmit} disabled={saving || request.status === 'submitted'}>
                        <Send className="h-4 w-4 mr-1" />
                        Submit for Review
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  function renderStepContent(stepId: string, stepData: any) {
    // If HR is viewing but not in edit mode, or if Manager is viewing, make fields read-only
    const isReadOnly = (isHRView && !isHREditMode) || isManagerView;
    
    // Helper to add disabled prop to form elements
    const getFieldProps = () => ({ disabled: isReadOnly });
    
    switch (stepId) {
      case 'personalDetails':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Personal Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Full Name (as per Aadhaar/PAN) *</Label>
                <Input
                  value={stepData.fullName || ''}
                  onChange={(e) => updateFormData('personalDetails', 'fullName', e.target.value)}
                  disabled={isReadOnly}
                  required
                />
              </div>
              <div>
                <Label>Date of Birth *</Label>
                <Input
                  type="date"
                  value={stepData.dateOfBirth ? (typeof stepData.dateOfBirth === 'string' ? stepData.dateOfBirth.split('T')[0] : new Date(stepData.dateOfBirth).toISOString().split('T')[0]) : ''}
                  onChange={(e) => updateFormData('personalDetails', 'dateOfBirth', e.target.value)}
                  disabled={isReadOnly}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Gender *</Label>
                <Select
                  value={stepData.gender || ''}
                  onValueChange={(value) => updateFormData('personalDetails', 'gender', value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Marital Status *</Label>
                <Select
                  value={stepData.maritalStatus || ''}
                  onValueChange={(value) => updateFormData('personalDetails', 'maritalStatus', value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married</SelectItem>
                    <SelectItem value="divorced">Divorced</SelectItem>
                    <SelectItem value="widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nationality *</Label>
              <Input
                value={stepData.nationality || ''}
                onChange={(e) => updateFormData('personalDetails', 'nationality', e.target.value)}
                placeholder="e.g., Indian"
                disabled={isReadOnly}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Personal Email *</Label>
                <Input
                  type="email"
                  value={stepData.personalEmail || ''}
                  onChange={(e) => updateFormData('personalDetails', 'personalEmail', e.target.value)}
                  disabled={isReadOnly}
                  required
                />
              </div>
              <div>
                <Label>Mobile Number *</Label>
                <Input
                  type="tel"
                  value={stepData.mobileNumber || ''}
                  onChange={(e) => updateFormData('personalDetails', 'mobileNumber', e.target.value)}
                  placeholder="10-digit mobile number"
                  disabled={isReadOnly}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Photograph</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Upload your photograph (JPG/PNG, max 5MB)</p>
                <Input type="file" disabled={isReadOnly} accept="image/jpeg,image/png" className="mt-2" />
              </div>
            </div>
          </div>
        );

      case 'addressDetails':
        // Ensure address objects are initialized with country
        const currentAddr = stepData.currentAddress || { country: 'India' };
        const permanentAddr = stepData.permanentAddress || { country: 'India' };
        if (!currentAddr.country) currentAddr.country = 'India';
        if (!permanentAddr.country) permanentAddr.country = 'India';
        
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Address Details</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-3">Current Address *</h4>
                <div className="space-y-3">
                  <Input
                    placeholder="Address Line 1"
                    value={currentAddr.line1 || ''}
                    onChange={(e) =>
                      updateFormData('addressDetails', {
                        ...stepData,
                        currentAddress: {
                          ...currentAddr,
                          line1: e.target.value,
                          country: currentAddr.country || 'India',
                        },
                      })
                    }
                    disabled={isReadOnly}
                    required
                  />
                  <Input
                    placeholder="Address Line 2 (Optional)"
                    value={currentAddr.line2 || ''}
                    onChange={(e) =>
                      updateFormData('addressDetails', {
                        ...stepData,
                        currentAddress: {
                          ...currentAddr,
                          line2: e.target.value,
                          country: currentAddr.country || 'India',
                        },
                      })
                    }
                    disabled={isReadOnly}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="City"
                      value={currentAddr.city || ''}
                      onChange={(e) =>
                        updateFormData('addressDetails', {
                          ...stepData,
                          currentAddress: {
                            ...currentAddr,
                            city: e.target.value,
                            country: currentAddr.country || 'India',
                          },
                        })
                      }
                      disabled={isReadOnly}
                      required
                    />
                    <Input
                      placeholder="State"
                      value={currentAddr.state || ''}
                      onChange={(e) =>
                        updateFormData('addressDetails', {
                          ...stepData,
                          currentAddress: {
                            ...currentAddr,
                            state: e.target.value,
                            country: currentAddr.country || 'India',
                          },
                        })
                      }
                      disabled={isReadOnly}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Pincode"
                      value={currentAddr.pincode || ''}
                      onChange={(e) =>
                        updateFormData('addressDetails', {
                          ...stepData,
                          currentAddress: {
                            ...currentAddr,
                            pincode: e.target.value,
                            country: currentAddr.country || 'India',
                          },
                        })
                      }
                      disabled={isReadOnly}
                      required
                    />
                    <Input
                      placeholder="Country"
                      value={currentAddr.country || 'India'}
                      onChange={(e) =>
                        updateFormData('addressDetails', {
                          ...stepData,
                          currentAddress: {
                            ...currentAddr,
                            country: e.target.value || 'India',
                          },
                        })
                      }
                      disabled={isReadOnly}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="sameAsCurrent"
                  checked={stepData.sameAsCurrent || false}
                  disabled={isReadOnly}
                  onChange={(e) => {
                    const sameAsCurrent = e.target.checked;
                    if (sameAsCurrent && currentAddr) {
                      // Copy current address to permanent address, ensuring country is set
                      updateFormData('addressDetails', {
                        ...stepData,
                        sameAsCurrent,
                        permanentAddress: {
                          ...currentAddr,
                          country: currentAddr.country || 'India',
                        },
                      });
                    } else {
                      updateFormData('addressDetails', {
                        ...stepData,
                        sameAsCurrent,
                        permanentAddress: permanentAddr,
                      });
                    }
                  }}
                  className="rounded"
                />
                <Label htmlFor="sameAsCurrent">Same as Current Address</Label>
              </div>

              {!stepData.sameAsCurrent && (
                <div>
                  <h4 className="font-medium mb-3">Permanent Address *</h4>
                  <div className="space-y-3">
                    <Input
                      placeholder="Address Line 1"
                      value={permanentAddr.line1 || ''}
                      onChange={(e) =>
                        updateFormData('addressDetails', {
                          ...stepData,
                          permanentAddress: {
                            ...permanentAddr,
                            line1: e.target.value,
                            country: permanentAddr.country || 'India',
                          },
                        })
                      }
                      disabled={isReadOnly}
                      required
                    />
                    <Input
                      placeholder="Address Line 2 (Optional)"
                      value={permanentAddr.line2 || ''}
                      onChange={(e) =>
                        updateFormData('addressDetails', {
                          ...stepData,
                          permanentAddress: {
                            ...permanentAddr,
                            line2: e.target.value,
                            country: permanentAddr.country || 'India',
                          },
                        })
                      }
                      disabled={isReadOnly}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="City"
                        value={permanentAddr.city || ''}
                        onChange={(e) =>
                          updateFormData('addressDetails', {
                            ...stepData,
                            permanentAddress: {
                              ...permanentAddr,
                              city: e.target.value,
                              country: permanentAddr.country || 'India',
                            },
                          })
                        }
                        disabled={isReadOnly}
                        required
                      />
                      <Input
                        placeholder="State"
                        value={permanentAddr.state || ''}
                        onChange={(e) =>
                          updateFormData('addressDetails', {
                            ...stepData,
                            permanentAddress: {
                              ...permanentAddr,
                              state: e.target.value,
                              country: permanentAddr.country || 'India',
                            },
                          })
                        }
                        disabled={isReadOnly}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="Pincode"
                        value={permanentAddr.pincode || ''}
                        onChange={(e) =>
                          updateFormData('addressDetails', {
                            ...stepData,
                            permanentAddress: {
                              ...permanentAddr,
                              pincode: e.target.value,
                              country: permanentAddr.country || 'India',
                            },
                          })
                        }
                        disabled={isReadOnly}
                        required
                      />
                      <Input
                        placeholder="Country"
                        value={permanentAddr.country || 'India'}
                        onChange={(e) =>
                          updateFormData('addressDetails', {
                            ...stepData,
                            permanentAddress: {
                              ...permanentAddr,
                              country: e.target.value || 'India',
                            },
                          })
                        }
                        disabled={isReadOnly}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'identityKYC':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Identity & KYC Documents</h3>
            <div className="space-y-4">
              <div>
                <Label>Aadhaar Number</Label>
                <Input
                  value={stepData.aadhaarNumber || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    updateFormData('identityKYC', 'aadhaarNumber', value);
                  }}
                  placeholder="12-digit Aadhaar number"
                  maxLength={12}
                  disabled={isReadOnly}
                />
                {stepData.aadhaarNumber && !validateAadhaar(stepData.aadhaarNumber) && (
                  <p className="text-sm text-red-500 mt-1">Invalid Aadhaar number</p>
                )}
              </div>
              <div>
                <Label>Aadhaar Document</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Upload Aadhaar (PDF/JPG, max 5MB)</p>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-2" disabled={isReadOnly} />
                </div>
              </div>
              <div>
                <Label>PAN Number</Label>
                <Input
                  value={stepData.panNumber || ''}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    updateFormData('identityKYC', 'panNumber', value);
                  }}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  disabled={isReadOnly}
                />
                {stepData.panNumber && !validatePAN(stepData.panNumber) && (
                  <p className="text-sm text-red-500 mt-1">Invalid PAN format</p>
                )}
              </div>
              <div>
                <Label>PAN Document</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Upload PAN (PDF/JPG, max 5MB)</p>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-2" disabled={isReadOnly} />
                </div>
              </div>
              <div>
                <Label>Passport Number (Optional)</Label>
                <Input
                  value={stepData.passportNumber || ''}
                  onChange={(e) => updateFormData('identityKYC', 'passportNumber', e.target.value)}
                  placeholder="Passport number"
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label>Passport Document (Optional)</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Upload Passport (PDF/JPG, max 5MB)</p>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-2" disabled={isReadOnly} />
                </div>
              </div>
            </div>
          </div>
        );

      case 'employmentDetails':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Employment Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date of Joining *</Label>
                <Input
                  type="date"
                  value={
                    stepData.dateOfJoining
                      ? typeof stepData.dateOfJoining === 'string'
                        ? stepData.dateOfJoining.split('T')[0]
                        : new Date(stepData.dateOfJoining).toISOString().split('T')[0]
                      : request?.dateOfJoining
                      ? typeof request.dateOfJoining === 'string'
                        ? request.dateOfJoining.split('T')[0]
                        : new Date(request.dateOfJoining).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) => {
                    updateFormData('employmentDetails', {
                      ...stepData,
                      dateOfJoining: e.target.value,
                    });
                  }}
                  disabled={isReadOnly}
                  required
                />
              </div>
              <div>
                <Label>Employment Type *</Label>
                <Select
                  value={stepData.employmentType || ''}
                  onValueChange={(value) => {
                    updateFormData('employmentDetails', {
                      ...stepData,
                      employmentType: value,
                    });
                  }}
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full-Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Department *</Label>
                <Input
                  value={stepData.department || request?.department || ''}
                  onChange={(e) => {
                    updateFormData('employmentDetails', {
                      ...stepData,
                      department: e.target.value,
                    });
                  }}
                  disabled={isReadOnly}
                  required
                />
              </div>
              <div>
                <Label>Designation *</Label>
                <Input
                  value={stepData.designation || request?.designation || ''}
                  onChange={(e) => {
                    updateFormData('employmentDetails', {
                      ...stepData,
                      designation: e.target.value,
                    });
                  }}
                  disabled={isReadOnly}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Work Location *</Label>
              <Input
                value={stepData.workLocation || request?.workLocation || ''}
                onChange={(e) => {
                  updateFormData('employmentDetails', {
                    ...stepData,
                    workLocation: e.target.value,
                  });
                }}
                disabled={isReadOnly}
                required
              />
            </div>
            <div>
              <Label>Reporting Manager</Label>
              <Input
                value={
                  stepData.reportingManagerId
                    ? request?.reportingManagerId?.name || ''
                    : request?.reportingManagerId?.name || ''
                }
                disabled
                placeholder="Pre-filled from HR"
                className="bg-muted"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Probation Status</Label>
                <Select
                  value={stepData.probationStatus ? 'yes' : 'no'}
                  onValueChange={(value) => {
                    updateFormData('employmentDetails', {
                      ...stepData,
                      probationStatus: value === 'yes',
                    });
                  }}
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No Probation</SelectItem>
                    <SelectItem value="yes">On Probation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {stepData.probationStatus && (
                <div>
                  <Label>Probation Period (Months)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="12"
                    value={stepData.probationPeriodMonths || ''}
                    onChange={(e) => {
                      updateFormData('employmentDetails', {
                        ...stepData,
                        probationPeriodMonths: parseInt(e.target.value) || 0,
                      });
                    }}
                    disabled={isReadOnly}
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 'compensationPayroll':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Compensation & Payroll</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Annual CTC (₹) *</Label>
                <Input
                  type="number"
                  value={stepData.annualCTC || ''}
                  onChange={(e) => {
                    updateFormData('compensationPayroll', {
                      ...stepData,
                      annualCTC: parseFloat(e.target.value) || 0,
                    });
                  }}
                  disabled={isReadOnly}
                  required
                />
              </div>
              <div>
                <Label>Basic Salary (₹) *</Label>
                <Input
                  type="number"
                  value={stepData.basicSalary || ''}
                  onChange={(e) => {
                    updateFormData('compensationPayroll', {
                      ...stepData,
                      basicSalary: parseFloat(e.target.value) || 0,
                    });
                  }}
                  disabled={isReadOnly}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>HRA (₹) *</Label>
                <Input
                  type="number"
                  value={stepData.hra || ''}
                  onChange={(e) => {
                    updateFormData('compensationPayroll', {
                      ...stepData,
                      hra: parseFloat(e.target.value) || 0,
                    });
                  }}
                  disabled={isReadOnly}
                  required
                />
              </div>
              <div>
                <Label>Allowances (₹) *</Label>
                <Input
                  type="number"
                  value={stepData.allowances || ''}
                  onChange={(e) => {
                    updateFormData('compensationPayroll', {
                      ...stepData,
                      allowances: parseFloat(e.target.value) || 0,
                    });
                  }}
                  disabled={isReadOnly}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Pay Frequency *</Label>
              <Select
                value={stepData.payFrequency || 'monthly'}
                onValueChange={(value) => {
                  updateFormData('compensationPayroll', {
                    ...stepData,
                    payFrequency: value,
                  });
                }}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="pfApplicable"
                  checked={stepData.pfApplicable !== false}
                  onChange={(e) => {
                    updateFormData('compensationPayroll', {
                      ...stepData,
                      pfApplicable: e.target.checked,
                    });
                  }}
                  disabled={isReadOnly}
                  className="rounded"
                />
                <Label htmlFor="pfApplicable">PF Applicable</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="esiApplicable"
                  checked={stepData.esiApplicable || false}
                  onChange={(e) => {
                    updateFormData('compensationPayroll', {
                      ...stepData,
                      esiApplicable: e.target.checked,
                    });
                  }}
                  disabled={isReadOnly}
                  className="rounded"
                />
                <Label htmlFor="esiApplicable">ESI Applicable</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bank Name *</Label>
                <Input
                  value={stepData.bankName || ''}
                  onChange={(e) => {
                    updateFormData('compensationPayroll', {
                      ...stepData,
                      bankName: e.target.value,
                    });
                  }}
                  disabled={isReadOnly}
                  required
                />
              </div>
              <div>
                <Label>Account Number *</Label>
                <Input
                  value={stepData.accountNumber || ''}
                  onChange={(e) => {
                    updateFormData('compensationPayroll', {
                      ...stepData,
                      accountNumber: e.target.value,
                    });
                  }}
                  disabled={isReadOnly}
                  required
                />
              </div>
            </div>
            <div>
              <Label>IFSC Code *</Label>
              <Input
                value={stepData.ifscCode || ''}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  updateFormData('compensationPayroll', {
                    ...stepData,
                    ifscCode: value,
                  });
                }}
                placeholder="ABCD0123456"
                maxLength={11}
                disabled={isReadOnly}
                required
              />
              {stepData.ifscCode && !validateIFSC(stepData.ifscCode) && (
                <p className="text-sm text-red-500 mt-1">Invalid IFSC code format</p>
              )}
            </div>
            <div>
              <Label>Bank Proof (Cancelled Cheque / Bank Statement)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Upload Bank Proof (PDF/JPG, max 5MB)</p>
                <Input type="file" disabled={isReadOnly} accept=".pdf,.jpg,.jpeg,.png" className="mt-2" />
              </div>
            </div>
          </div>
        );

      case 'statutoryTax':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Statutory & Tax Information</h3>
            <div>
              <Label>PF UAN (Universal Account Number)</Label>
              <Input
                value={stepData.pfUAN || ''}
                onChange={(e) => updateFormData('statutoryTax', 'pfUAN', e.target.value)}
                placeholder="12-digit UAN"
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>ESIC Number</Label>
              <Input
                value={stepData.esicNumber || ''}
                onChange={(e) => updateFormData('statutoryTax', 'esicNumber', e.target.value)}
                placeholder="ESIC number"
                disabled={isReadOnly}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="professionalTaxApplicable"
                checked={stepData.professionalTaxApplicable !== false}
                onChange={(e) => updateFormData('statutoryTax', 'professionalTaxApplicable', e.target.checked)}
                disabled={isReadOnly}
                className="rounded"
              />
              <Label htmlFor="professionalTaxApplicable">Professional Tax Applicable</Label>
            </div>
            <div>
              <Label>Income Tax Regime *</Label>
              <Select
                value={stepData.incomeTaxRegime || 'old'}
                onValueChange={(value) => updateFormData('statutoryTax', 'incomeTaxRegime', value)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="old">Old Tax Regime</SelectItem>
                  <SelectItem value="new">New Tax Regime</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'educationDetails':
        // Ensure educationList is always an array
        let educationList = Array.isArray(stepData) ? stepData : [];
        
        // If list is empty, initialize with one empty entry for display
        if (educationList.length === 0) {
          educationList = [{ qualification: '', degree: '', institution: '', yearOfPassing: new Date().getFullYear() }];
        }
        
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Education Details</h3>
            <p className="text-sm text-muted-foreground mb-4">Add at least one education detail. You can add multiple entries.</p>
            {educationList.map((edu: any, index: number) => (
              <Card key={index} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Education #{index + 1}</h4>
                    {educationList.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          const newList = educationList.filter((_: any, i: number) => i !== index);
                          // Ensure at least one entry remains
                          const finalList = newList.length > 0 ? newList : [{ qualification: '', degree: '', institution: '', yearOfPassing: new Date().getFullYear() }];
                          updateFormData('educationDetails', finalList);
                        }}
                        disabled={isReadOnly}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Qualification *</Label>
                      <Input
                        value={edu.qualification || ''}
                        onChange={(e) => {
                          const newList = [...educationList];
                          newList[index] = { ...newList[index], qualification: e.target.value };
                          updateFormData('educationDetails', newList);
                        }}
                        placeholder="e.g., Bachelor's, Master's, Diploma"
                        disabled={isReadOnly}
                        required
                      />
                    </div>
                    <div>
                      <Label>Degree / Course *</Label>
                      <Input
                        value={edu.degree || ''}
                        onChange={(e) => {
                          const newList = [...educationList];
                          newList[index] = { ...newList[index], degree: e.target.value };
                          updateFormData('educationDetails', newList);
                        }}
                        placeholder="e.g., B.Tech, MBA, B.Com"
                        disabled={isReadOnly}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Institution *</Label>
                    <Input
                      value={edu.institution || ''}
                      onChange={(e) => {
                        const newList = [...educationList];
                        newList[index] = { ...newList[index], institution: e.target.value };
                        updateFormData('educationDetails', newList);
                      }}
                      placeholder="University/College name"
                      disabled={isReadOnly}
                      required
                    />
                  </div>
                  <div>
                    <Label>Year of Passing *</Label>
                    <Input
                      type="number"
                      value={edu.yearOfPassing || ''}
                      onChange={(e) => {
                        const newList = [...educationList];
                        newList[index] = { ...newList[index], yearOfPassing: parseInt(e.target.value) || new Date().getFullYear() };
                        updateFormData('educationDetails', newList);
                      }}
                      placeholder={new Date().getFullYear().toString()}
                      disabled={isReadOnly}
                      required
                    />
                  </div>
                  <div>
                    <Label>Degree Certificate (Optional)</Label>
                    <div className="border-2 border-dashed rounded-lg p-3 text-center">
                      <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Upload Certificate (PDF/JPG, max 5MB)</p>
                      <Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-1 text-xs" disabled={isReadOnly} />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const newList = [...educationList, { qualification: '', degree: '', institution: '', yearOfPassing: new Date().getFullYear() }];
                updateFormData('educationDetails', newList);
              }}
              disabled={isReadOnly}
              className="w-full"
            >
              + Add Another Education Detail
            </Button>
          </div>
        );

      case 'previousEmployment':
        const employmentList = Array.isArray(stepData) ? stepData : [];
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Previous Employment (Optional)</h3>
            {employmentList.map((emp: any, index: number) => (
              <Card key={index} className="p-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Company Name *</Label>
                      <Input
                        value={emp.companyName || ''}
                        onChange={(e) => {
                          const newList = [...employmentList];
                          newList[index] = { ...newList[index], companyName: e.target.value };
                          updateFormData('previousEmployment', newList);
                        }}
                        disabled={isReadOnly}
                        required
                      />
                    </div>
                    <div>
                      <Label>Designation *</Label>
                      <Input
                        value={emp.designation || ''}
                        onChange={(e) => {
                          const newList = [...employmentList];
                          newList[index] = { ...newList[index], designation: e.target.value };
                          updateFormData('previousEmployment', newList);
                        }}
                        disabled={isReadOnly}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Start Date *</Label>
                      <Input
                        type="date"
                        value={emp.startDate ? new Date(emp.startDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const newList = [...employmentList];
                          newList[index] = { ...newList[index], startDate: e.target.value };
                          updateFormData('previousEmployment', newList);
                        }}
                        disabled={isReadOnly}
                        required
                      />
                    </div>
                    <div>
                      <Label>End Date *</Label>
                      <Input
                        type="date"
                        value={emp.endDate ? new Date(emp.endDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const newList = [...employmentList];
                          newList[index] = { ...newList[index], endDate: e.target.value };
                          updateFormData('previousEmployment', newList);
                        }}
                        disabled={isReadOnly}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Reason for Leaving *</Label>
                    <Textarea
                      value={emp.reasonForLeaving || ''}
                      onChange={(e) => {
                        const newList = [...employmentList];
                        newList[index] = { ...newList[index], reasonForLeaving: e.target.value };
                        updateFormData('previousEmployment', newList);
                      }}
                      disabled={isReadOnly}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Experience Letter</Label>
                      <div className="border-2 border-dashed rounded-lg p-3 text-center">
                        <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Upload (PDF/JPG, max 5MB)</p>
                        <Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-1 text-xs" disabled={isReadOnly} />
                      </div>
                    </div>
                    <div>
                      <Label>Relieving Letter</Label>
                      <div className="border-2 border-dashed rounded-lg p-3 text-center">
                        <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Upload (PDF/JPG, max 5MB)</p>
                        <Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-1 text-xs" disabled={isReadOnly} />
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const newList = employmentList.filter((_: any, i: number) => i !== index);
                      updateFormData('previousEmployment', newList);
                    }}
                    disabled={isReadOnly}
                  >
                    Remove
                  </Button>
                </div>
              </Card>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const newList = [...employmentList, { companyName: '', designation: '', startDate: '', endDate: '', reasonForLeaving: '' }];
                updateFormData('previousEmployment', newList);
              }}
              disabled={isReadOnly}
            >
              Add Previous Employment
            </Button>
          </div>
        );

      case 'emergencyContact':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Emergency Contact</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contact Name *</Label>
                <Input
                  value={stepData.name || ''}
                  onChange={(e) => updateFormData('emergencyContact', 'name', e.target.value)}
                  disabled={isReadOnly}
                  required
                />
              </div>
              <div>
                <Label>Relationship *</Label>
                <Input
                  value={stepData.relationship || ''}
                  onChange={(e) => updateFormData('emergencyContact', 'relationship', e.target.value)}
                  placeholder="e.g., Father, Mother, Spouse"
                  disabled={isReadOnly}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mobile Number *</Label>
                <Input
                  type="tel"
                  value={stepData.mobileNumber || ''}
                  onChange={(e) => updateFormData('emergencyContact', 'mobileNumber', e.target.value)}
                  disabled={isReadOnly}
                  required
                />
              </div>
              <div>
                <Label>Email (Optional)</Label>
                <Input
                  type="email"
                  value={stepData.email || ''}
                  onChange={(e) => updateFormData('emergencyContact', 'email', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </div>
        );

      case 'policiesDeclarations':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Policies & Declarations</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <input
                  type="checkbox"
                  id="offerLetterAccepted"
                  checked={stepData.offerLetterAccepted || false}
                  onChange={(e) => updateFormData('policiesDeclarations', 'offerLetterAccepted', e.target.checked)}
                  disabled={isReadOnly}
                  className="mt-1 rounded"
                  required
                />
                <div className="flex-1">
                  <Label htmlFor="offerLetterAccepted" className="font-medium">
                    I accept the terms and conditions mentioned in the Offer Letter *
                  </Label>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <input
                  type="checkbox"
                  id="ndaSigned"
                  checked={stepData.ndaSigned || false}
                  onChange={(e) => updateFormData('policiesDeclarations', 'ndaSigned', e.target.checked)}
                  disabled={isReadOnly}
                  className="mt-1 rounded"
                  required
                />
                <div className="flex-1">
                  <Label htmlFor="ndaSigned" className="font-medium">
                    I have read and agree to the Non-Disclosure Agreement (NDA) *
                  </Label>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <input
                  type="checkbox"
                  id="codeOfConductAccepted"
                  checked={stepData.codeOfConductAccepted || false}
                  onChange={(e) => updateFormData('policiesDeclarations', 'codeOfConductAccepted', e.target.checked)}
                  disabled={isReadOnly}
                  className="mt-1 rounded"
                  required
                />
                <div className="flex-1">
                  <Label htmlFor="codeOfConductAccepted" className="font-medium">
                    I have read and agree to the Code of Conduct *
                  </Label>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <input
                  type="checkbox"
                  id="poshPolicyAcknowledged"
                  checked={stepData.poshPolicyAcknowledged || false}
                  onChange={(e) => updateFormData('policiesDeclarations', 'poshPolicyAcknowledged', e.target.checked)}
                  disabled={isReadOnly}
                  className="mt-1 rounded"
                  required
                />
                <div className="flex-1">
                  <Label htmlFor="poshPolicyAcknowledged" className="font-medium">
                    I acknowledge that I have read the Prevention of Sexual Harassment (POSH) Policy *
                  </Label>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <input
                  type="checkbox"
                  id="dataPrivacyConsent"
                  checked={stepData.dataPrivacyConsent || false}
                  onChange={(e) => updateFormData('policiesDeclarations', 'dataPrivacyConsent', e.target.checked)}
                  disabled={isReadOnly}
                  className="mt-1 rounded"
                  required
                />
                <div className="flex-1">
                  <Label htmlFor="dataPrivacyConsent" className="font-medium">
                    I consent to the collection, processing, and storage of my personal data as per the Data Privacy Policy *
                  </Label>
                </div>
              </div>
              <div>
                <Label>Signed Documents</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Upload signed documents (PDF, max 5MB)</p>
                  <Input type="file" accept=".pdf" className="mt-2" disabled={isReadOnly} />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Unknown step</div>;
    }
  }
}
