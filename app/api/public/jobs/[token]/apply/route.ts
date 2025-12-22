import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import JobRequisition from '@/lib/models/JobRequisition';
import Candidate from '@/lib/models/Candidate';
import { generateCandidateId } from '@/lib/utils/interview';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const publicApplicationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  resume: z.string().optional(), // Base64 encoded file
  resumeUrl: z.string().url().optional(), // Direct URL if already uploaded
  coverLetter: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  githubUrl: z.string().url().optional().or(z.literal('')),
  portfolioUrl: z.string().url().optional().or(z.literal('')),
  currentCompany: z.string().optional(),
  currentDesignation: z.string().optional(),
  totalExperience: z.number().min(0).optional(),
  expectedCTC: z.number().min(0).optional(),
  noticePeriod: z.number().min(0).default(0),
  source: z.enum(['career_page', 'job_board', 'linkedin', 'referral', 'other']).default('career_page'),
});

/**
 * Upload base64 file to Cloudinary
 */
async function uploadBase64ToCloudinary(base64String: string, fileName: string, folder: string): Promise<string> {
  try {
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        base64String,
        {
          folder: folder,
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    });

    return (uploadResult as any).secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error('Failed to upload resume');
  }
}

// POST - Submit application (no auth required)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await connectDB();
    const { token } = await params;

    // Find job by public token
    const jobRequisition = await JobRequisition.findOne({
      publicToken: token,
      allowPublicApplications: true,
      isActive: true,
      status: 'open',
    });

    if (!jobRequisition) {
      return NextResponse.json({ error: 'Job not found or applications closed' }, { status: 404 });
    }

    // Check deadline
    if (jobRequisition.publicApplicationDeadline && new Date() > jobRequisition.publicApplicationDeadline) {
      return NextResponse.json({ error: 'Application deadline has passed' }, { status: 400 });
    }

    const body = await req.json();
    const validatedData = publicApplicationSchema.parse(body);

    // Check for duplicate application
    const existingCandidate = await Candidate.findOne({
      email: validatedData.email.toLowerCase(),
      jobRequisitionId: jobRequisition._id,
      isActive: true,
    });

    if (existingCandidate) {
      return NextResponse.json(
        { error: 'You have already applied for this position' },
        { status: 400 }
      );
    }

    // Handle resume upload (if base64 provided)
    let resumeUrl: string | undefined = validatedData.resumeUrl;
    
    if (!resumeUrl && validatedData.resume) {
      // Extract file extension from base64 data URI
      const matches = validatedData.resume.match(/data:([^;]+);base64,(.+)/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        
        // Determine file extension from mime type
        let extension = 'pdf';
        if (mimeType.includes('pdf')) extension = 'pdf';
        else if (mimeType.includes('msword') || mimeType.includes('wordprocessingml')) extension = 'doc';
        else if (mimeType.includes('vnd.openxmlformats')) extension = 'docx';
        
        try {
          resumeUrl = await uploadBase64ToCloudinary(
            validatedData.resume,
            `resume-${Date.now()}.${extension}`,
            'public-resumes'
          );
        } catch (error) {
          return NextResponse.json(
            { error: 'Failed to upload resume. Please try again.' },
            { status: 500 }
          );
        }
      }
    }

    if (!resumeUrl) {
      return NextResponse.json(
        { error: 'Resume is required' },
        { status: 400 }
      );
    }

    // Generate candidate ID
    const currentYear = new Date().getFullYear();
    const count = await Candidate.countDocuments({
      candidateId: new RegExp(`^CAN-${currentYear}-`),
    });
    const candidateId = generateCandidateId(currentYear, count + 1);

    // Create candidate
    const candidate = await Candidate.create({
      candidateId,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      email: validatedData.email.toLowerCase(),
      phoneNumber: validatedData.phoneNumber,
      jobRequisitionId: jobRequisition._id,
      appliedPosition: jobRequisition.jobTitle,
      source: validatedData.source,
      resumeUrl,
      coverLetterUrl: validatedData.coverLetter || undefined,
      linkedinUrl: validatedData.linkedinUrl || undefined,
      githubUrl: validatedData.githubUrl || undefined,
      portfolioUrl: validatedData.portfolioUrl || undefined,
      currentCompany: validatedData.currentCompany || undefined,
      currentDesignation: validatedData.currentDesignation || undefined,
      totalExperience: validatedData.totalExperience || undefined,
      expectedCTC: validatedData.expectedCTC || undefined,
      noticePeriod: validatedData.noticePeriod || 0,
      status: 'applied',
      appliedAt: new Date(),
      lastActivityAt: new Date(),
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully',
      candidateId: candidate.candidateId,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Error submitting application:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

