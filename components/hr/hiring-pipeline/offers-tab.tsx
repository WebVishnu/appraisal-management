'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Handshake,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Eye,
  Plus,
  FileText,
  UserCheck,
  ArrowRight,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { formatDate, formatErrorMessage } from '@/lib/utils/format';
import { SkeletonCard } from '@/components/shared/skeleton-loader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Offer {
  _id: string;
  offerId: string;
  candidateId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    candidateId: string;
  };
  jobTitle: string;
  department: string;
  status: string;
  compensation: {
    annualCTC: number;
    currency: string;
  };
  startDate: string;
  offerValidUntil: string;
  offerSentAt?: string;
  offerAcceptedAt?: string;
  candidateResponse?: string;
  convertedToOnboardingRequestId?: string;
}

interface Candidate {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  candidateId: string;
  status: string;
  jobRequisitionId: {
    _id: string;
    jobTitle: string;
    department: string;
    location: string;
    employmentType: string;
  };
}

interface JobRequisition {
  _id: string;
  jobTitle: string;
  department: string;
  location: string;
  employmentType: string;
  requisitionId: string;
}

interface Shift {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  shiftType: string;
}

export default function OffersTab() {
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobRequisitions, setJobRequisitions] = useState<JobRequisition[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<string>('');
  const [selectedJobRequisition, setSelectedJobRequisition] = useState<string>('');
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [offerToWithdraw, setOfferToWithdraw] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');

  const [formData, setFormData] = useState({
    candidateId: '',
    jobRequisitionId: '',
    jobTitle: '',
    department: '',
    location: '',
    employmentType: 'full_time' as const,
    startDate: '',
    offerValidUntil: '',
    annualCTC: '',
    basicSalary: '',
    hra: '',
    specialAllowance: '',
    lta: '0',
    medicalAllowance: '0',
    performanceBonus: '',
    otherBenefits: '',
    currency: 'INR',
    benefits: [] as string[],
    benefitsDescription: '',
    noticePeriod: '',
    probationPeriod: '',
    workShiftId: '',
    workLocationDetails: '',
    requiresApproval: true,
    createOnboardingRequest: true,
  });

  const [newBenefit, setNewBenefit] = useState('');

  useEffect(() => {
    fetchOffers();
  }, [statusFilter]);

  useEffect(() => {
    if (isCreateDialogOpen) {
      fetchEligibleCandidates();
      fetchJobRequisitions();
      fetchShifts();
    }
  }, [isCreateDialogOpen]);

  useEffect(() => {
    if (selectedCandidate) {
      const candidate = candidates.find(c => c._id === selectedCandidate);
      if (candidate && candidate.jobRequisitionId) {
        // Auto-select the job requisition from candidate
        const jobReqId = candidate.jobRequisitionId._id;
        setSelectedJobRequisition(jobReqId);
        setFormData(prev => ({
          ...prev,
          candidateId: selectedCandidate,
          jobRequisitionId: jobReqId,
          // Only update if we have values, otherwise keep existing
          jobTitle: candidate.jobRequisitionId.jobTitle || prev.jobTitle || '',
          department: candidate.jobRequisitionId.department || prev.department || '',
          location: candidate.jobRequisitionId.location || prev.location || '',
          employmentType: (candidate.jobRequisitionId.employmentType as any) || prev.employmentType,
        }));
      }
    }
  }, [selectedCandidate, candidates]);

  useEffect(() => {
    if (selectedJobRequisition) {
      const jobReq = jobRequisitions.find(jr => jr._id === selectedJobRequisition);
      if (jobReq) {
        setFormData(prev => ({
          ...prev,
          jobRequisitionId: selectedJobRequisition, // Ensure jobRequisitionId is set
          jobTitle: jobReq.jobTitle || prev.jobTitle || '',
          department: jobReq.department || prev.department || '',
          location: jobReq.location || prev.location || '',
          employmentType: (jobReq.employmentType as any) || prev.employmentType,
        }));
      }
    }
  }, [selectedJobRequisition, jobRequisitions]);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/interviews/offers?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setOffers(data);
      } else {
        toast.error('Failed to fetch offers');
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
      toast.error('Error fetching offers');
    } finally {
      setLoading(false);
    }
  };

  const fetchEligibleCandidates = async () => {
    setLoadingCandidates(true);
    try {
      // Fetch candidates with interview_completed or offer_pending status
      const response = await fetch('/api/interviews/candidates?status=interview_completed,offer_pending');
      if (response.ok) {
        const data = await response.json();
        // Filter out candidates who already have active offers
        const candidatesWithOffers = new Set(
          offers
            .filter(o => o.status !== 'rejected' && o.status !== 'expired' && o.status !== 'withdrawn')
            .map(o => o.candidateId._id)
        );
        const eligible = data.filter((c: Candidate) => !candidatesWithOffers.has(c._id));
        setCandidates(eligible);
      } else {
        const errorData = await response.json();
        console.error('Error fetching candidates:', errorData);
        toast.error('Failed to fetch candidates');
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast.error('Error fetching candidates');
    } finally {
      setLoadingCandidates(false);
    }
  };

  const fetchJobRequisitions = async () => {
    try {
      const response = await fetch('/api/interviews/job-requisitions?status=open');
      if (response.ok) {
        const data = await response.json();
        setJobRequisitions(data);
      }
    } catch (error) {
      console.error('Error fetching job requisitions:', error);
    }
  };

  const fetchShifts = async () => {
    try {
      // Create shifts API endpoint if it doesn't exist
      const response = await fetch('/api/shifts?isActive=true');
      if (response.ok) {
        const data = await response.json();
        setShifts(data);
      } else {
        // If endpoint doesn't exist, log but don't fail
        console.warn('Shifts API endpoint not found');
      }
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  };

  const handleCreate = async () => {
    try {
      // Trim and validate all required fields
      const trimmedJobTitle = formData.jobTitle?.trim() || '';
      const trimmedDepartment = formData.department?.trim() || '';
      const trimmedLocation = formData.location?.trim() || '';
      
      // Check all required fields
      const missingFields: string[] = [];
      if (!formData.candidateId || formData.candidateId.trim() === '') {
        missingFields.push('Candidate');
      }
      if (!formData.jobRequisitionId || formData.jobRequisitionId.trim() === '') {
        missingFields.push('Job Requisition');
      }
      if (!trimmedJobTitle) {
        missingFields.push('Job Title');
      }
      if (!trimmedDepartment) {
        missingFields.push('Department');
      }
      if (!trimmedLocation) {
        missingFields.push('Location');
      }
      if (!formData.startDate || formData.startDate.trim() === '') {
        missingFields.push('Start Date');
      }
      if (!formData.offerValidUntil || formData.offerValidUntil.trim() === '') {
        missingFields.push('Offer Valid Until');
      }

      if (missingFields.length > 0) {
        toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);
        return;
      }

      const annualCTC = parseFloat(formData.annualCTC);
      const basicSalary = parseFloat(formData.basicSalary);
      const hra = parseFloat(formData.hra);
      const specialAllowance = parseFloat(formData.specialAllowance);

      if (!annualCTC || !basicSalary || !hra || !specialAllowance) {
        toast.error('Please fill in all compensation fields');
        return;
      }

      // Calculate total to verify it matches annualCTC
      const calculatedTotal = basicSalary + hra + specialAllowance + 
        (parseFloat(formData.lta) || 0) + 
        (parseFloat(formData.medicalAllowance) || 0) + 
        (parseFloat(formData.performanceBonus) || 0) + 
        (parseFloat(formData.otherBenefits) || 0);

      if (Math.abs(calculatedTotal - annualCTC) > 1) {
        toast.error('Compensation breakdown must equal Annual CTC');
        return;
      }

      const response = await fetch('/api/interviews/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: formData.candidateId.trim(),
          jobRequisitionId: formData.jobRequisitionId.trim(),
          jobTitle: trimmedJobTitle,
          department: trimmedDepartment,
          location: trimmedLocation,
          employmentType: formData.employmentType,
          startDate: new Date(formData.startDate).toISOString(),
          offerValidUntil: new Date(formData.offerValidUntil).toISOString(),
          compensation: {
            annualCTC,
            basicSalary,
            hra,
            specialAllowance,
            lta: parseFloat(formData.lta) || 0,
            medicalAllowance: parseFloat(formData.medicalAllowance) || 0,
            performanceBonus: parseFloat(formData.performanceBonus) || undefined,
            otherBenefits: parseFloat(formData.otherBenefits) || undefined,
            currency: formData.currency,
          },
          benefits: formData.benefits,
          benefitsDescription: formData.benefitsDescription || undefined,
          noticePeriod: formData.noticePeriod ? parseInt(formData.noticePeriod) : undefined,
          probationPeriod: formData.probationPeriod ? parseInt(formData.probationPeriod) : undefined,
          workShiftId: formData.workShiftId || undefined,
          workLocationDetails: formData.workLocationDetails || undefined,
          requiresApproval: formData.requiresApproval,
          createOnboardingRequest: formData.createOnboardingRequest,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const messages = ['Offer created successfully'];
        if (formData.createOnboardingRequest && data.onboardingRequestId) {
          messages.push('Onboarding request created automatically');
        }
        toast.success(messages.join('. '));
        setIsCreateDialogOpen(false);
        resetForm();
        fetchOffers();
        window.dispatchEvent(new CustomEvent('refreshOnboardingTab'));
      } else {
        toast.error(formatErrorMessage(data.error, 'Failed to create offer'));
      }
    } catch (error: any) {
      console.error('Error creating offer:', error);
      toast.error(formatErrorMessage(error, 'Failed to create offer'));
    }
  };

  const resetForm = () => {
    setFormData({
      candidateId: '',
      jobRequisitionId: '',
      jobTitle: '',
      department: '',
      location: '',
      employmentType: 'full_time',
      startDate: '',
      offerValidUntil: '',
      annualCTC: '',
      basicSalary: '',
      hra: '',
      specialAllowance: '',
      lta: '0',
      medicalAllowance: '0',
      performanceBonus: '',
      otherBenefits: '',
      currency: 'INR',
      benefits: [],
      benefitsDescription: '',
      noticePeriod: '',
      probationPeriod: '',
      workShiftId: '',
      workLocationDetails: '',
      requiresApproval: true,
      createOnboardingRequest: true,
    });
    setSelectedCandidate('');
    setSelectedJobRequisition('');
    setNewBenefit('');
  };

  const addBenefit = () => {
    if (newBenefit.trim()) {
      setFormData({
        ...formData,
        benefits: [...formData.benefits, newBenefit.trim()],
      });
      setNewBenefit('');
    }
  };

  const removeBenefit = (index: number) => {
    setFormData({
      ...formData,
      benefits: formData.benefits.filter((_, i) => i !== index),
    });
  };

  const handleSendOffer = async (offerId: string) => {
    try {
      const response = await fetch('/api/interviews/offers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: offerId,
          status: 'sent',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Offer sent successfully');
        fetchOffers();
      } else {
        toast.error(formatErrorMessage(data.error, 'Failed to send offer'));
      }
    } catch (error: any) {
      console.error('Error sending offer:', error);
      toast.error(formatErrorMessage(error, 'Failed to send offer'));
    }
  };

  const handleViewOnboarding = (onboardingRequestId: string) => {
    window.dispatchEvent(new CustomEvent('navigateToOnboarding', { detail: { id: onboardingRequestId } }));
    toast.info('Navigate to Onboarding tab to view details');
  };

  const openWithdrawDialog = (offerId: string) => {
    setOfferToWithdraw(offerId);
    setWithdrawDialogOpen(true);
  };

  const handleWithdrawOffer = async () => {
    if (!offerToWithdraw) return;

    try {
      const response = await fetch('/api/interviews/offers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: offerToWithdraw,
          status: 'withdrawn',
          withdrawnReason: withdrawReason.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Offer withdrawn successfully. Associated onboarding request has been deleted.');
        setWithdrawDialogOpen(false);
        setOfferToWithdraw(null);
        setWithdrawReason('');
        fetchOffers();
        // Refresh onboarding tab if it's open
        window.dispatchEvent(new CustomEvent('refreshOnboardingTab'));
      } else {
        toast.error(formatErrorMessage(data.error, 'Failed to withdraw offer'));
      }
    } catch (error: any) {
      console.error('Error withdrawing offer:', error);
      toast.error(formatErrorMessage(error, 'Failed to withdraw offer'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'approved':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'sent':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'accepted':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'expired':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'withdrawn':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Offers</h2>
          <p className="text-sm text-muted-foreground">Manage job offers and track acceptance</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Offer
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Offers</p>
                <p className="text-2xl font-bold">{offers.length}</p>
              </div>
              <Handshake className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold">
                  {offers.filter(o => o.status === 'pending_approval').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sent</p>
                <p className="text-2xl font-bold">
                  {offers.filter(o => o.status === 'sent').length}
                </p>
              </div>
              <Send className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Accepted</p>
                <p className="text-2xl font-bold">
                  {offers.filter(o => o.status === 'accepted').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Offers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Job Offers</CardTitle>
          <CardDescription>{offers.length} offer(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Handshake className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No offers found</p>
              <Button
                className="mt-4"
                onClick={() => setIsCreateDialogOpen(true)}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Offer
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Offer ID</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>CTC</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Onboarding</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offers.map((offer) => (
                    <TableRow key={offer._id}>
                      <TableCell className="font-mono text-xs">{offer.offerId}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {offer.candidateId.firstName} {offer.candidateId.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{offer.candidateId.candidateId}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{offer.jobTitle}</p>
                          <p className="text-xs text-muted-foreground">{offer.department}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="font-medium">
                            {offer.compensation.currency} {offer.compensation.annualCTC.toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(offer.startDate)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(offer.status)}>
                          {offer.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {offer.candidateResponse ? (
                          <Badge className={
                            offer.candidateResponse === 'accepted'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }>
                            {offer.candidateResponse === 'accepted' ? (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            {offer.candidateResponse.replace('_', ' ')}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {offer.convertedToOnboardingRequestId ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewOnboarding(offer.convertedToOnboardingRequestId!)}
                          >
                            <UserCheck className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not Created</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {offer.status === 'approved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendOffer(offer._id)}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Send
                            </Button>
                          )}
                          {offer.status === 'sent' && offer.offerSentAt && (
                            <div className="text-xs text-muted-foreground">
                              Sent: {formatDate(offer.offerSentAt)}
                            </div>
                          )}
                          {offer.status === 'accepted' && offer.offerAcceptedAt && (
                            <div className="text-xs text-green-600">
                              Accepted: {formatDate(offer.offerAcceptedAt)}
                            </div>
                          )}
                          {/* Withdraw button - available for offers that haven't been accepted/rejected/withdrawn/expired */}
                          {offer.status !== 'withdrawn' && 
                           offer.status !== 'accepted' && 
                           offer.status !== 'rejected' && 
                           offer.status !== 'expired' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openWithdrawDialog(offer._id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Withdraw
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Offer Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Job Offer</DialogTitle>
            <DialogDescription>
              Create a new job offer for a candidate. Onboarding request will be created automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Candidate Selection */}
            <div>
              <Label>Candidate *</Label>
              <Select
                value={selectedCandidate}
                onValueChange={(value) => {
                  setSelectedCandidate(value);
                  setFormData({ ...formData, candidateId: value });
                }}
                disabled={loadingCandidates}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingCandidates ? "Loading candidates..." : "Select candidate"} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No eligible candidates found. Candidates must have completed interviews.
                    </div>
                  ) : (
                    candidates.map((candidate) => (
                      <SelectItem key={candidate._id} value={candidate._id}>
                        {candidate.firstName} {candidate.lastName} ({candidate.candidateId}) - {candidate.status}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Job Requisition Selection */}
            <div>
              <Label>Job Requisition *</Label>
              <Select
                value={selectedJobRequisition}
                onValueChange={(value) => {
                  setSelectedJobRequisition(value);
                  setFormData({ ...formData, jobRequisitionId: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select job requisition" />
                </SelectTrigger>
                <SelectContent>
                  {jobRequisitions.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No open job requisitions found
                    </div>
                  ) : (
                    jobRequisitions.map((jr) => (
                      <SelectItem key={jr._id} value={jr._id}>
                        {jr.jobTitle} - {jr.department} ({jr.requisitionId})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Job Details - Auto-filled but editable */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Job Title *</Label>
                <Input
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Department *</Label>
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Location *</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Enter work location"
                  required
                />
              </div>
              <div>
                <Label>Employment Type *</Label>
                <Select
                  value={formData.employmentType}
                  onValueChange={(value: any) => setFormData({ ...formData, employmentType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Offer Valid Until *</Label>
                <Input
                  type="date"
                  value={formData.offerValidUntil}
                  onChange={(e) => setFormData({ ...formData, offerValidUntil: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Compensation Section - Same as before */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">Compensation</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Annual CTC (INR) *</Label>
                  <Input
                    type="number"
                    value={formData.annualCTC}
                    onChange={(e) => setFormData({ ...formData, annualCTC: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label>Basic Salary *</Label>
                  <Input
                    type="number"
                    value={formData.basicSalary}
                    onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>HRA *</Label>
                  <Input
                    type="number"
                    value={formData.hra}
                    onChange={(e) => setFormData({ ...formData, hra: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label>Special Allowance *</Label>
                  <Input
                    type="number"
                    value={formData.specialAllowance}
                    onChange={(e) => setFormData({ ...formData, specialAllowance: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>LTA</Label>
                  <Input
                    type="number"
                    value={formData.lta}
                    onChange={(e) => setFormData({ ...formData, lta: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label>Medical Allowance</Label>
                  <Input
                    type="number"
                    value={formData.medicalAllowance}
                    onChange={(e) => setFormData({ ...formData, medicalAllowance: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Performance Bonus</Label>
                  <Input
                    type="number"
                    value={formData.performanceBonus}
                    onChange={(e) => setFormData({ ...formData, performanceBonus: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-4">
                <Label>Other Benefits</Label>
                <Input
                  type="number"
                  value={formData.otherBenefits}
                  onChange={(e) => setFormData({ ...formData, otherBenefits: e.target.value })}
                />
              </div>
            </div>

            {/* Benefits */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">Benefits</h3>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newBenefit}
                  onChange={(e) => setNewBenefit(e.target.value)}
                  placeholder="Add a benefit..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addBenefit();
                    }
                  }}
                />
                <Button type="button" onClick={addBenefit} size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.benefits.map((benefit, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {benefit}
                    <button
                      type="button"
                      onClick={() => removeBenefit(index)}
                      className="ml-1 hover:opacity-70"
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="mt-4">
                <Label>Benefits Description</Label>
                <Textarea
                  value={formData.benefitsDescription}
                  onChange={(e) => setFormData({ ...formData, benefitsDescription: e.target.value })}
                  rows={3}
                  placeholder="Describe the benefits package..."
                />
              </div>
            </div>

            {/* Work Shift Selection */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">Work Schedule</h3>
              <div>
                <Label>Work Shift</Label>
                <Select
                  value={formData.workShiftId}
                  onValueChange={(value) => setFormData({ ...formData, workShiftId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select work shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No shifts available
                      </div>
                    ) : (
                      shifts.map((shift) => (
                        <SelectItem key={shift._id} value={shift._id}>
                          {shift.name} ({shift.startTime} - {shift.endTime})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-4">
                <Label>Work Location Details</Label>
                <Textarea
                  value={formData.workLocationDetails}
                  onChange={(e) => setFormData({ ...formData, workLocationDetails: e.target.value })}
                  rows={2}
                  placeholder="Additional location details..."
                />
              </div>
            </div>

            {/* Additional Details - Same as before but remove workTimings */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">Additional Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Notice Period (days)</Label>
                  <Input
                    type="number"
                    value={formData.noticePeriod}
                    onChange={(e) => setFormData({ ...formData, noticePeriod: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Probation Period (days)</Label>
                  <Input
                    type="number"
                    value={formData.probationPeriod}
                    onChange={(e) => setFormData({ ...formData, probationPeriod: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Auto-create Onboarding Request */}
            <div className="border-t pt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="createOnboarding"
                  checked={formData.createOnboardingRequest}
                  onChange={(e) => setFormData({ ...formData, createOnboardingRequest: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="createOnboarding" className="cursor-pointer">
                  Automatically create onboarding request
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                An onboarding request will be created immediately when the offer is created
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>
              Create Offer {formData.createOnboardingRequest && '& Onboarding'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Offer Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Withdraw Offer
            </DialogTitle>
            <DialogDescription>
              This action will withdraw the offer and delete the associated onboarding request (if created). 
              The candidate status will be updated to rejected. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="withdrawReason">Reason for Withdrawal (Optional)</Label>
              <Textarea
                id="withdrawReason"
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="Enter reason for withdrawing this offer..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setWithdrawDialogOpen(false);
                setOfferToWithdraw(null);
                setWithdrawReason('');
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleWithdrawOffer}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Withdraw Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

