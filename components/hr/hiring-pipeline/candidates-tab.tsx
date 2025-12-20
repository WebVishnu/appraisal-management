'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus,
  Edit,
  Eye,
  Users,
  Search,
  Filter,
  TrendingUp,
  Calendar,
  Briefcase,
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
import { getStatusDisplayName, type CandidateStatus } from '@/lib/utils/candidate-state-machine';

const getStatusBadgeClass = (status: CandidateStatus): string => {
  const colorMap: Record<CandidateStatus, string> = {
    applied: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    screening: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    shortlisted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    interview_scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    interview_in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    interview_completed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    offer_pending: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    offer_sent: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    offer_accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    offer_rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    offer_expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    selected: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    withdrawn: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
};

interface Candidate {
  _id: string;
  candidateId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: string;
  currentStage?: string;
  overallScore?: number;
  appliedAt: string;
  lastActivityAt: string;
  jobRequisitionId?: {
    _id: string;
    jobTitle: string;
    department: string;
  };
  assignedRecruiterId?: {
    _id: string;
    email: string;
  };
  source: string;
}

export default function CandidatesTab() {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobRequisitions, setJobRequisitions] = useState<Array<{ _id: string; jobTitle: string; jobRequisitionId: string }>>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [jobFilter, setJobFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    jobRequisitionId: '',
    source: 'direct' as const,
    currentCompany: '',
    currentDesignation: '',
    totalExperience: 0,
    currentCTC: 0,
    expectedCTC: 0,
    noticePeriod: 0,
    notes: '',
  });

  useEffect(() => {
    fetchCandidates();
    fetchJobRequisitions();
  }, [statusFilter, jobFilter, searchTerm]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (jobFilter !== 'all') params.append('jobRequisitionId', jobFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/interviews/candidates?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setCandidates(data);
      } else {
        toast.error('Failed to fetch candidates');
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast.error('Error fetching candidates');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobRequisitions = async () => {
    try {
      const response = await fetch('/api/interviews/job-requisitions?status=open');
      if (response.ok) {
        const data = await response.json();
        setJobRequisitions(data.map((req: any) => ({
          _id: req._id,
          jobTitle: req.jobTitle,
          jobRequisitionId: req.jobRequisitionId,
        })));
      }
    } catch (error) {
      console.error('Error fetching job requisitions:', error);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.jobRequisitionId) {
        toast.error('Please fill in all required fields');
        return;
      }

      const response = await fetch('/api/interviews/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Candidate created successfully');
        setIsCreateDialogOpen(false);
        resetForm();
        fetchCandidates();
      } else {
        toast.error(formatErrorMessage(data.error, 'Failed to create candidate'));
      }
    } catch (error: any) {
      console.error('Error creating candidate:', error);
      toast.error(formatErrorMessage(error, 'Failed to create candidate'));
    }
  };

  const handleView = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setIsViewDialogOpen(true);
  };

  const handleStatusUpdate = async (candidateId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/interviews/candidates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: candidateId,
          status: newStatus,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Candidate status updated successfully');
        fetchCandidates();
      } else {
        toast.error(formatErrorMessage(data.error, 'Failed to update status'));
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(formatErrorMessage(error, 'Failed to update status'));
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      jobRequisitionId: '',
      source: 'direct',
      currentCompany: '',
      currentDesignation: '',
      totalExperience: 0,
      currentCTC: 0,
      expectedCTC: 0,
      noticePeriod: 0,
      notes: '',
    });
  };

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Candidates</h2>
          <p className="text-sm text-muted-foreground">Manage all candidates in the hiring pipeline</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Candidate
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="screening">Screening</SelectItem>
                  <SelectItem value="shortlisted">Shortlisted</SelectItem>
                  <SelectItem value="interview_scheduled">Interview Scheduled</SelectItem>
                  <SelectItem value="interview_in_progress">Interview In Progress</SelectItem>
                  <SelectItem value="interview_completed">Interview Completed</SelectItem>
                  <SelectItem value="offer_pending">Offer Pending</SelectItem>
                  <SelectItem value="offer_sent">Offer Sent</SelectItem>
                  <SelectItem value="selected">Selected</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Job Requisition</Label>
              <Select value={jobFilter} onValueChange={setJobFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {jobRequisitions.map((req) => (
                    <SelectItem key={req._id} value={req._id}>
                      {req.jobTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Search</Label>
              <Input
                placeholder="Search by name, email, or candidate ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Candidates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Candidates</CardTitle>
          <CardDescription>{candidates.length} candidate(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {candidates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No candidates found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <TableRow key={candidate._id}>
                      <TableCell className="font-mono text-xs">{candidate.candidateId}</TableCell>
                      <TableCell className="font-medium">
                        {candidate.firstName} {candidate.lastName}
                      </TableCell>
                      <TableCell className="text-sm">{candidate.email}</TableCell>
                      <TableCell>
                        {candidate.jobRequisitionId?.jobTitle || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeClass(candidate.status as CandidateStatus)}>
                          {getStatusDisplayName(candidate.status as CandidateStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {candidate.overallScore !== undefined ? (
                          <span className="font-medium">{candidate.overallScore}%</span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(candidate.appliedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleView(candidate)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Select
                            value={candidate.status}
                            onValueChange={(value) => handleStatusUpdate(candidate._id, value)}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="applied">Applied</SelectItem>
                              <SelectItem value="screening">Screening</SelectItem>
                              <SelectItem value="shortlisted">Shortlisted</SelectItem>
                              <SelectItem value="interview_scheduled">Interview Scheduled</SelectItem>
                              <SelectItem value="interview_in_progress">Interview In Progress</SelectItem>
                              <SelectItem value="interview_completed">Interview Completed</SelectItem>
                              <SelectItem value="offer_pending">Offer Pending</SelectItem>
                              <SelectItem value="offer_sent">Offer Sent</SelectItem>
                              <SelectItem value="selected">Selected</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                              <SelectItem value="on_hold">On Hold</SelectItem>
                            </SelectContent>
                          </Select>
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

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
            <DialogDescription>Add a new candidate to the hiring pipeline</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Phone Number *</Label>
              <Input
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Job Requisition *</Label>
              <Select
                value={formData.jobRequisitionId}
                onValueChange={(value) => setFormData({ ...formData, jobRequisitionId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select job requisition" />
                </SelectTrigger>
                <SelectContent>
                  {jobRequisitions.map((req) => (
                    <SelectItem key={req._id} value={req._id}>
                      {req.jobTitle} ({req.jobRequisitionId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source</Label>
              <Select
                value={formData.source}
                onValueChange={(value: any) => setFormData({ ...formData, source: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="career_page">Career Page</SelectItem>
                  <SelectItem value="job_board">Job Board</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Current Company</Label>
                <Input
                  value={formData.currentCompany}
                  onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
                />
              </div>
              <div>
                <Label>Current Designation</Label>
                <Input
                  value={formData.currentDesignation}
                  onChange={(e) => setFormData({ ...formData, currentDesignation: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Experience (Years)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.totalExperience}
                  onChange={(e) => setFormData({ ...formData, totalExperience: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Current CTC</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.currentCTC}
                  onChange={(e) => setFormData({ ...formData, currentCTC: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Expected CTC</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.expectedCTC}
                  onChange={(e) => setFormData({ ...formData, expectedCTC: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label>Notice Period (Days)</Label>
              <Input
                type="number"
                min="0"
                value={formData.noticePeriod}
                onChange={(e) => setFormData({ ...formData, noticePeriod: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Add Candidate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Candidate Details</DialogTitle>
            <DialogDescription>View complete candidate information</DialogDescription>
          </DialogHeader>
          {selectedCandidate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Candidate ID</Label>
                  <p className="font-mono text-sm">{selectedCandidate.candidateId}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={getStatusBadgeClass(selectedCandidate.status as CandidateStatus)}>
                    {getStatusDisplayName(selectedCandidate.status as CandidateStatus)}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p>{selectedCandidate.firstName} {selectedCandidate.lastName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p>{selectedCandidate.email}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Position</Label>
                <p>{selectedCandidate.jobRequisitionId?.jobTitle || '-'}</p>
              </div>
              {selectedCandidate.overallScore !== undefined && (
                <div>
                  <Label className="text-muted-foreground">Overall Score</Label>
                  <p className="text-lg font-bold">{selectedCandidate.overallScore}%</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

