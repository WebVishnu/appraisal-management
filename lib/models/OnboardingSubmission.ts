import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPersonalDetails {
  fullName: string; // As per Aadhaar/PAN
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  nationality: string;
  personalEmail: string;
  mobileNumber: string;
  photographUrl?: string; // Uploaded file URL
}

export interface IAddressDetails {
  currentAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  permanentAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  sameAsCurrent: boolean;
}

export interface IIdentityKYC {
  aadhaarNumber?: string; // 12 digits
  panNumber?: string; // 10 characters
  passportNumber?: string;
  aadhaarDocumentUrl?: string;
  panDocumentUrl?: string;
  passportDocumentUrl?: string;
}

export interface IEmploymentDetails {
  dateOfJoining: Date;
  employmentType: 'full_time' | 'contract' | 'intern';
  department: string;
  designation: string;
  reportingManagerId?: mongoose.Types.ObjectId;
  workLocation: string;
  probationStatus: boolean;
  probationPeriodMonths?: number;
}

export interface ICompensationPayroll {
  annualCTC: number;
  basicSalary: number;
  hra: number;
  allowances: number;
  payFrequency: 'monthly' | 'bi_weekly' | 'weekly';
  pfApplicable: boolean;
  esiApplicable: boolean;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  bankProofUrl?: string; // Cancelled cheque or bank statement
}

export interface IStatutoryTax {
  pfUAN?: string;
  esicNumber?: string;
  professionalTaxApplicable: boolean;
  incomeTaxRegime: 'old' | 'new';
}

export interface IEducationDetail {
  qualification: string;
  degree: string;
  institution: string;
  yearOfPassing: number;
  degreeCertificateUrl?: string;
}

export interface IPreviousEmployment {
  companyName: string;
  designation: string;
  startDate: Date;
  endDate: Date;
  reasonForLeaving: string;
  experienceLetterUrl?: string;
  relievingLetterUrl?: string;
}

export interface IEmergencyContact {
  name: string;
  relationship: string;
  mobileNumber: string;
  email?: string;
}

export interface IPoliciesDeclarations {
  offerLetterAccepted: boolean;
  offerLetterAcceptedAt?: Date;
  ndaSigned: boolean;
  ndaSignedAt?: Date;
  codeOfConductAccepted: boolean;
  codeOfConductAcceptedAt?: Date;
  poshPolicyAcknowledged: boolean;
  poshPolicyAcknowledgedAt?: Date;
  dataPrivacyConsent: boolean;
  dataPrivacyConsentAt?: Date;
  signedDocumentsUrl?: string; // Combined signed documents
}

export interface IOnboardingSubmission extends Document {
  onboardingRequestId: mongoose.Types.ObjectId;
  employeeId?: mongoose.Types.ObjectId; // Link to employee after approval
  
  // Step completion tracking
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
  
  // Step data
  personalDetails?: IPersonalDetails;
  addressDetails?: IAddressDetails;
  identityKYC?: IIdentityKYC;
  employmentDetails?: IEmploymentDetails;
  compensationPayroll?: ICompensationPayroll;
  statutoryTax?: IStatutoryTax;
  educationDetails?: IEducationDetail[];
  previousEmployment?: IPreviousEmployment[];
  emergencyContact?: IEmergencyContact;
  policiesDeclarations?: IPoliciesDeclarations;
  
  // Submission tracking
  isDraft: boolean;
  submittedAt?: Date;
  lastSavedAt: Date;
  
  // Validation status
  validationErrors?: Array<{
    step: string;
    field: string;
    message: string;
  }>;
  
  createdAt: Date;
  updatedAt: Date;
}

const PersonalDetailsSchema = new Schema<IPersonalDetails>(
  {
    fullName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
      required: true,
    },
    maritalStatus: {
      type: String,
      enum: ['single', 'married', 'divorced', 'widowed'],
      required: true,
    },
    nationality: { type: String, required: true, trim: true },
    personalEmail: { type: String, required: true, lowercase: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    photographUrl: { type: String, trim: true },
  },
  { _id: false }
);

const AddressDetailsSchema = new Schema<IAddressDetails>(
  {
    currentAddress: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true },
    },
    permanentAddress: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true },
    },
    sameAsCurrent: { type: Boolean, default: false },
  },
  { _id: false }
);

const IdentityKYCSchema = new Schema<IIdentityKYC>(
  {
    aadhaarNumber: { type: String, trim: true },
    panNumber: { type: String, trim: true },
    passportNumber: { type: String, trim: true },
    aadhaarDocumentUrl: { type: String, trim: true },
    panDocumentUrl: { type: String, trim: true },
    passportDocumentUrl: { type: String, trim: true },
  },
  { _id: false }
);

const EmploymentDetailsSchema = new Schema<IEmploymentDetails>(
  {
    dateOfJoining: { type: Date, required: true },
    employmentType: {
      type: String,
      enum: ['full_time', 'contract', 'intern'],
      required: true,
    },
    department: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    reportingManagerId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    workLocation: { type: String, required: true, trim: true },
    probationStatus: { type: Boolean, default: false },
    probationPeriodMonths: { type: Number, min: 0, max: 12 },
  },
  { _id: false }
);

const CompensationPayrollSchema = new Schema<ICompensationPayroll>(
  {
    annualCTC: { type: Number, required: true, min: 0 },
    basicSalary: { type: Number, required: true, min: 0 },
    hra: { type: Number, required: true, min: 0 },
    allowances: { type: Number, required: true, min: 0 },
    payFrequency: {
      type: String,
      enum: ['monthly', 'bi_weekly', 'weekly'],
      required: true,
    },
    pfApplicable: { type: Boolean, default: true },
    esiApplicable: { type: Boolean, default: false },
    bankName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    ifscCode: { type: String, required: true, trim: true },
    bankProofUrl: { type: String, trim: true },
  },
  { _id: false }
);

const StatutoryTaxSchema = new Schema<IStatutoryTax>(
  {
    pfUAN: { type: String, trim: true },
    esicNumber: { type: String, trim: true },
    professionalTaxApplicable: { type: Boolean, default: true },
    incomeTaxRegime: {
      type: String,
      enum: ['old', 'new'],
      default: 'old',
    },
  },
  { _id: false }
);

const EducationDetailSchema = new Schema<IEducationDetail>(
  {
    qualification: { type: String, required: true, trim: true },
    degree: { type: String, required: true, trim: true },
    institution: { type: String, required: true, trim: true },
    yearOfPassing: { type: Number, required: true },
    degreeCertificateUrl: { type: String, trim: true },
  },
  { _id: false }
);

const PreviousEmploymentSchema = new Schema<IPreviousEmployment>(
  {
    companyName: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reasonForLeaving: { type: String, required: true, trim: true },
    experienceLetterUrl: { type: String, trim: true },
    relievingLetterUrl: { type: String, trim: true },
  },
  { _id: false }
);

const EmergencyContactSchema = new Schema<IEmergencyContact>(
  {
    name: { type: String, required: true, trim: true },
    relationship: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
  },
  { _id: false }
);

const PoliciesDeclarationsSchema = new Schema<IPoliciesDeclarations>(
  {
    offerLetterAccepted: { type: Boolean, required: true },
    offerLetterAcceptedAt: { type: Date, default: null },
    ndaSigned: { type: Boolean, required: true },
    ndaSignedAt: { type: Date, default: null },
    codeOfConductAccepted: { type: Boolean, required: true },
    codeOfConductAcceptedAt: { type: Date, default: null },
    poshPolicyAcknowledged: { type: Boolean, required: true },
    poshPolicyAcknowledgedAt: { type: Date, default: null },
    dataPrivacyConsent: { type: Boolean, required: true },
    dataPrivacyConsentAt: { type: Date, default: null },
    signedDocumentsUrl: { type: String, trim: true },
  },
  { _id: false }
);

const OnboardingSubmissionSchema = new Schema<IOnboardingSubmission>(
  {
    onboardingRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'OnboardingRequest',
      required: true,
      unique: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },
    stepsCompleted: {
      personalDetails: { type: Boolean, default: false },
      addressDetails: { type: Boolean, default: false },
      identityKYC: { type: Boolean, default: false },
      employmentDetails: { type: Boolean, default: false },
      compensationPayroll: { type: Boolean, default: false },
      statutoryTax: { type: Boolean, default: false },
      educationDetails: { type: Boolean, default: false },
      previousEmployment: { type: Boolean, default: false },
      emergencyContact: { type: Boolean, default: false },
      policiesDeclarations: { type: Boolean, default: false },
    },
    personalDetails: { type: PersonalDetailsSchema, default: null },
    addressDetails: { type: AddressDetailsSchema, default: null },
    identityKYC: { type: IdentityKYCSchema, default: null },
    employmentDetails: { type: EmploymentDetailsSchema, default: null },
    compensationPayroll: { type: CompensationPayrollSchema, default: null },
    statutoryTax: { type: StatutoryTaxSchema, default: null },
    educationDetails: { type: [EducationDetailSchema], default: [] },
    previousEmployment: { type: [PreviousEmploymentSchema], default: [] },
    emergencyContact: { type: EmergencyContactSchema, default: null },
    policiesDeclarations: { type: PoliciesDeclarationsSchema, default: null },
    isDraft: {
      type: Boolean,
      default: true,
      index: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    lastSavedAt: {
      type: Date,
      default: Date.now,
    },
    validationErrors: {
      type: [
        {
          step: String,
          field: String,
          message: String,
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Calculate progress percentage before save
OnboardingSubmissionSchema.pre('save', function (next) {
  const steps = this.stepsCompleted;
  const totalSteps = 10;
  let completedSteps = 0;
  
  if (steps.personalDetails) completedSteps++;
  if (steps.addressDetails) completedSteps++;
  if (steps.identityKYC) completedSteps++;
  if (steps.employmentDetails) completedSteps++;
  if (steps.compensationPayroll) completedSteps++;
  if (steps.statutoryTax) completedSteps++;
  if (steps.educationDetails) completedSteps++;
  if (steps.previousEmployment) completedSteps++;
  if (steps.emergencyContact) completedSteps++;
  if (steps.policiesDeclarations) completedSteps++;
  
  // Update progress in OnboardingRequest
  if (this.isModified('stepsCompleted') || this.isNew) {
    const progress = Math.round((completedSteps / totalSteps) * 100);
    // This will be updated via the API
  }
  
  next();
});

const OnboardingSubmission: Model<IOnboardingSubmission> =
  mongoose.models.OnboardingSubmission ||
  mongoose.model<IOnboardingSubmission>('OnboardingSubmission', OnboardingSubmissionSchema);

export default OnboardingSubmission;
