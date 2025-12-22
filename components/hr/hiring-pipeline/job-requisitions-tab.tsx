'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Briefcase,
  MapPin,
  Users,
  Calendar,
  DollarSign,
  Copy,
  Link as LinkIcon,
  ExternalLink,
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

interface JobRequisition {
  _id: string;
  jobRequisitionId: string;
  jobTitle: string;
  department: string;
  location: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  status: 'open' | 'on_hold' | 'closed' | 'cancelled';
  numberOfPositions: number;
  positionsFilled: number;
  publicToken?: string;
  allowPublicApplications?: boolean;
  hiringManagerId?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  interviewRounds?: Array<{
    roundName: string;
    roundOrder: number;
    roundType: string;
  }>;
}

export default function JobRequisitionsTab() {
  const [loading, setLoading] = useState(true);
  const [requisitions, setRequisitions] = useState<JobRequisition[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPublicLinkDialogOpen, setIsPublicLinkDialogOpen] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<JobRequisition | null>(null);
  const [managers, setManagers] = useState<Array<{ _id: string; name: string; employeeId: string }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    jobTitle: '',
    department: '',
    location: '',
    employmentType: 'full_time' as 'full_time' | 'part_time' | 'contract' | 'intern',
    description: '',
    requirements: '',
    responsibilities: '',
    requiredSkills: [] as string[],
    experienceRange: { min: 0, max: 0 },
    hiringManagerId: '',
    numberOfPositions: 1,
    interviewRounds: [] as Array<{
      roundName: string;
      roundOrder: number;
      roundType: string;
      requiredInterviewers: number;
      evaluationCriteria: Array<{ criterion: string; weightage: number }>;
      isMandatory: boolean;
    }>,
  });

  useEffect(() => {
    fetchRequisitions();
    fetchManagers();
  }, [statusFilter, searchTerm]);

  const fetchRequisitions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/interviews/job-requisitions?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRequisitions(data);
      } else {
        toast.error('Failed to fetch job requisitions');
      }
    } catch (error) {
      console.error('Error fetching requisitions:', error);
      toast.error('Error fetching job requisitions');
    } finally {
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setManagers(data.filter((emp: any) => 
          emp.role?.toLowerCase().includes('manager') || emp.role?.toLowerCase().includes('mgr')
        ));
      }
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.jobTitle || !formData.department || !formData.hiringManagerId) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Add default interview rounds if none provided
      if (formData.interviewRounds.length === 0) {
        formData.interviewRounds = [
          {
            roundName: 'HR Screening',
            roundOrder: 1,
            roundType: 'hr_screening',
            requiredInterviewers: 1,
            evaluationCriteria: [
              { criterion: 'Communication', weightage: 40 },
              { criterion: 'Culture Fit', weightage: 30 },
              { criterion: 'Experience', weightage: 30 },
            ],
            isMandatory: true,
          },
          {
            roundName: 'Technical Round',
            roundOrder: 2,
            roundType: 'technical',
            requiredInterviewers: 1,
            evaluationCriteria: [
              { criterion: 'Technical Skills', weightage: 50 },
              { criterion: 'Problem Solving', weightage: 30 },
              { criterion: 'Communication', weightage: 20 },
            ],
            isMandatory: true,
          },
        ];
      }

      const response = await fetch('/api/interviews/job-requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Job requisition created successfully');
        setIsCreateDialogOpen(false);
        resetForm();
        fetchRequisitions();
      } else {
        toast.error(formatErrorMessage(data.error, 'Failed to create job requisition'));
      }
    } catch (error: any) {
      console.error('Error creating requisition:', error);
      toast.error(formatErrorMessage(error, 'Failed to create job requisition'));
    }
  };

  const handleUpdate = async () => {
    if (!selectedRequisition) return;

    try {
      // Build update payload - prioritize status from selectedRequisition
      const updatePayload: any = {
        id: selectedRequisition._id,
      };

      // Always include status if selectedRequisition has it (this is the main use case)
      if (selectedRequisition.status) {
        updatePayload.status = selectedRequisition.status;
      }

      // Only include form fields that have non-empty values (for other edits)
      if (formData.jobTitle && formData.jobTitle.trim()) updatePayload.jobTitle = formData.jobTitle;
      if (formData.department && formData.department.trim()) updatePayload.department = formData.department;
      if (formData.location && formData.location.trim()) updatePayload.location = formData.location;
      if (formData.employmentType) updatePayload.employmentType = formData.employmentType;
      if (formData.description && formData.description.trim()) updatePayload.description = formData.description;
      if (formData.requirements && formData.requirements.trim()) updatePayload.requirements = formData.requirements;
      if (formData.responsibilities && formData.responsibilities.trim()) updatePayload.responsibilities = formData.responsibilities;
      if (formData.requiredSkills && formData.requiredSkills.length > 0) updatePayload.requiredSkills = formData.requiredSkills;
      // preferredSkills not in formData, skip if not present
      if (formData.experienceRange && (formData.experienceRange.min > 0 || formData.experienceRange.max > 0)) {
        updatePayload.experienceRange = formData.experienceRange;
      }
      if (formData.hiringManagerId && formData.hiringManagerId.trim()) updatePayload.hiringManagerId = formData.hiringManagerId;
      if (formData.numberOfPositions && formData.numberOfPositions > 0) updatePayload.numberOfPositions = formData.numberOfPositions;
      if (formData.interviewRounds && formData.interviewRounds.length > 0) updatePayload.interviewRounds = formData.interviewRounds;

      const response = await fetch('/api/interviews/job-requisitions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Job requisition updated successfully');
        setIsEditDialogOpen(false);
        resetForm();
        fetchRequisitions();
      } else {
        toast.error(formatErrorMessage(data.error, 'Failed to update job requisition'));
      }
    } catch (error: any) {
      console.error('Error updating requisition:', error);
      toast.error(formatErrorMessage(error, 'Failed to update job requisition'));
    }
  };

  const handleGeneratePublicToken = async (requisition: JobRequisition) => {
    try {
      // Set selected requisition first to show loading state
      setSelectedRequisition(requisition);
      setIsPublicLinkDialogOpen(true);

      const response = await fetch('/api/interviews/job-requisitions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: requisition._id,
          generatePublicToken: true,
          allowPublicApplications: true,
        }),
      });

      const data = await response.json();

      if (response.ok && data) {
        console.log('Public token generated, response data:', data);
        if (data.publicToken) {
          toast.success('Public link generated successfully');
          // Update the requisition in the list
          setRequisitions(prev => prev.map(req => 
            req._id === requisition._id ? { ...req, publicToken: data.publicToken, allowPublicApplications: data.allowPublicApplications } : req
          ));
          // Update the selected requisition with the token (use data directly as it has all fields)
          setSelectedRequisition(data);
        } else {
          console.error('Token not in response:', data);
          toast.error('Token was not generated. Please try again.');
          setIsPublicLinkDialogOpen(false);
        }
      } else {
        console.error('Failed to generate token, response:', data);
        const errorMsg = Array.isArray(data.error) ? data.error.map((e: any) => e.message || e).join(', ') : (data.error?.message || data.error || 'Failed to generate public token');
        toast.error(formatErrorMessage(errorMsg, 'Failed to generate public link'));
        setIsPublicLinkDialogOpen(false);
      }
    } catch (error: any) {
      console.error('Error generating public token:', error);
      toast.error(formatErrorMessage(error, 'Failed to generate public link'));
      setIsPublicLinkDialogOpen(false);
    }
  };

  const handleShowPublicLink = (requisition: JobRequisition) => {
    if (requisition.publicToken) {
      setSelectedRequisition(requisition);
      setIsPublicLinkDialogOpen(true);
    } else {
      handleGeneratePublicToken(requisition);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const getPublicApiUrl = () => {
    return typeof window !== 'undefined' ? `${window.location.origin}/api/public/jobs` : '/api/public/jobs';
  };

  const getWidgetEmbedCode = (token: string) => {
    const apiUrl = getPublicApiUrl();
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `<div id="job-application-widget" 
     data-hrms-job-widget 
     data-job-token="${token}"
     data-api-url="${apiUrl}">
</div>

<link rel="stylesheet" href="${baseUrl}/widget/hrms-widget.css">
<script src="${baseUrl}/widget/hrms-widget.js"></script>`;
  };

  const handleEdit = (requisition: JobRequisition) => {
    setSelectedRequisition(requisition);
    setFormData({
      jobTitle: requisition.jobTitle,
      department: requisition.department,
      location: requisition.location,
      employmentType: requisition.employmentType,
      description: '',
      requirements: '',
      responsibilities: '',
      requiredSkills: [],
      experienceRange: { min: 0, max: 0 },
      hiringManagerId: requisition.hiringManagerId?._id || '',
      numberOfPositions: requisition.numberOfPositions,
      interviewRounds: (requisition.interviewRounds || []).map(round => ({
        roundName: round.roundName,
        roundOrder: round.roundOrder,
        roundType: round.roundType,
        requiredInterviewers: 1,
        evaluationCriteria: [],
        isMandatory: true,
      })),
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      jobTitle: '',
      department: '',
      location: '',
      employmentType: 'full_time',
      description: '',
      requirements: '',
      responsibilities: '',
      requiredSkills: [],
      experienceRange: { min: 0, max: 0 },
      hiringManagerId: '',
      numberOfPositions: 1,
      interviewRounds: [],
    });
    setSelectedRequisition(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'cancelled':
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
          <h2 className="text-xl sm:text-2xl font-bold">Job Requisitions</h2>
          <p className="text-sm text-muted-foreground">Create and manage job openings</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Job Requisition
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Search</Label>
              <Input
                placeholder="Search by job title, department, or requisition ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requisitions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Job Requisitions</CardTitle>
          <CardDescription>{requisitions.length} requisition(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {requisitions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No job requisitions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requisition ID</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Positions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hiring Manager</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requisitions.map((req) => (
                    <TableRow key={req._id}>
                      <TableCell className="font-mono text-xs">{req.jobRequisitionId}</TableCell>
                      <TableCell className="font-medium">{req.jobTitle}</TableCell>
                      <TableCell>{req.department}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {req.location}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {req.positionsFilled}/{req.numberOfPositions}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(req.status)}>
                          {req.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{req.hiringManagerId?.name || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleShowPublicLink(req)}
                            title="Public Application Link"
                          >
                            <LinkIcon className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(req)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Job Requisition</DialogTitle>
            <DialogDescription>Create a new job opening with interview rounds</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
            <div>
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={3}
              />
            </div>
            <div>
              <Label>Requirements *</Label>
              <Textarea
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                required
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Min Experience (Years) *</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.experienceRange.min}
                  onChange={(e) => setFormData({
                    ...formData,
                    experienceRange: { ...formData.experienceRange, min: parseInt(e.target.value) || 0 }
                  })}
                  required
                />
              </div>
              <div>
                <Label>Max Experience (Years)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.experienceRange.max}
                  onChange={(e) => setFormData({
                    ...formData,
                    experienceRange: { ...formData.experienceRange, max: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hiring Manager *</Label>
                <Select
                  value={formData.hiringManagerId}
                  onValueChange={(value) => setFormData({ ...formData, hiringManagerId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((mgr) => (
                      <SelectItem key={mgr._id} value={mgr._id}>
                        {mgr.name} ({mgr.employeeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Number of Positions *</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.numberOfPositions}
                  onChange={(e) => setFormData({ ...formData, numberOfPositions: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job Requisition</DialogTitle>
            <DialogDescription>Update job requisition details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={selectedRequisition?.status || 'open'}
                  onValueChange={(value) => {
                    if (selectedRequisition) {
                      setSelectedRequisition({ ...selectedRequisition, status: value as any });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Add other editable fields as needed */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Public Link Dialog */}
      <Dialog open={isPublicLinkDialogOpen} onOpenChange={setIsPublicLinkDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Public Application Link</DialogTitle>
            <DialogDescription>
              Share this link or embed code to allow external candidates to apply for this position
            </DialogDescription>
          </DialogHeader>
          {!selectedRequisition ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No job requisition selected.</p>
            </div>
          ) : selectedRequisition.publicToken ? (
            <div className="space-y-4">
              <div>
                <Label>Public Token</Label>
                <div className="flex gap-2">
                  <Input
                    value={selectedRequisition.publicToken}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(selectedRequisition.publicToken!, 'Token')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label>Public Application Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/examples/widget-demo.html?token=${selectedRequisition.publicToken}`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(`${typeof window !== 'undefined' ? window.location.origin : ''}/examples/widget-demo.html?token=${selectedRequisition.publicToken}`, 'Application Link')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/examples/widget-demo.html?token=${selectedRequisition.publicToken}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Share this link for candidates to apply directly
                </p>
              </div>

              <div>
                <Label>Public API URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={`${getPublicApiUrl()}/${selectedRequisition.publicToken}`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(`${getPublicApiUrl()}/${selectedRequisition.publicToken}`, 'API URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  API endpoint for programmatic access
                </p>
              </div>

              <div>
                <Label>Widget Embed Code</Label>
                <div className="flex gap-2">
                  <Textarea
                    value={getWidgetEmbedCode(selectedRequisition.publicToken)}
                    readOnly
                    className="font-mono text-xs h-32"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(getWidgetEmbedCode(selectedRequisition.publicToken || ''), 'Embed code')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Copy this code and paste it into your website HTML to embed the application form
                </p>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-sm mb-2">Instructions:</h4>
                <ol className="text-xs space-y-1 list-decimal list-inside text-muted-foreground">
                  <li>Copy the embed code above</li>
                  <li>Paste it into your website where you want the application form to appear</li>
                  <li>Make sure to include both the CSS and JavaScript files</li>
                  <li>Candidates can now apply directly from your website</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted-foreground mb-2">Generating public token...</p>
              <p className="text-sm text-muted-foreground">Please wait while we create your public application link.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

