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
  Users,
  UserPlus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Send,
  Eye,
  Edit,
  Copy,
  RefreshCw,
  Trash2,
  Briefcase,
  Calendar,
  FileCheck,
  Award,
  ExternalLink,
  UserCheck,
  TrendingUp,
} from 'lucide-react';
import { formatDate, formatErrorMessage } from '@/lib/utils/format';
import { SkeletonCard } from '@/components/shared/skeleton-loader';
import { StatusBadge } from '@/components/shared/status-badge';

interface OnboardingRequest {
  _id: string;
  onboardingId: string;
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfJoining: string;
  department?: string;
  designation?: string;
  status: 'invited' | 'in_progress' | 'submitted' | 'changes_requested' | 'approved' | 'rejected' | 'completed';
  progressPercentage: number;
  invitedAt: string;
  startedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  tokenExpiry: string;
  reportingManagerId?: {
    _id: string;
    name: string;
    employeeId: string;
  };
  employeeId?: {
    _id: string;
    name: string;
    employeeId: string;
  };
  rejectionReason?: string;
  changeRequestComments?: string;
  reminderCount: number;
  // Hiring pipeline integration
  candidateId?: string;
  offerId?: string;
  source?: 'manual' | 'hiring_pipeline';
  candidate?: {
    _id: string;
    candidateId: string;
    jobRequisitionId?: {
      _id: string;
      jobTitle: string;
      department: string;
    };
  };
  offer?: {
    _id: string;
    offerId: string;
    compensation?: {
      annualCTC: number;
      currency: string;
    };
  };
}

interface OnboardingCounts {
  invited?: number;
  in_progress?: number;
  submitted?: number;
  changes_requested?: number;
  approved?: number;
  rejected?: number;
  completed?: number;
}

export default function OnboardingDashboardClient() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [counts, setCounts] = useState<OnboardingCounts>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<OnboardingRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'request_changes' | 'view' | 'delete' | 'view_candidate' | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all'); // 'all', 'manual', 'hiring_pipeline'
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create form data
  const [createFormData, setCreateFormData] = useState({
    email: '',
    personalEmail: '',
    mobileNumber: '',
    firstName: '',
    lastName: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    department: '',
    designation: '',
    reportingManagerId: '',
    workLocation: '',
    requiresManagerAck: false,
    expiryDays: 30,
    hrNotes: '',
  });
  
  // Action form data
  const [actionFormData, setActionFormData] = useState({
    rejectionReason: '',
    changeRequestComments: '',
  });

  const [managers, setManagers] = useState<Array<{ _id: string; name: string; employeeId: string }>>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    fetchOnboardingRequests();
    fetchManagers();
  }, [statusFilter, departmentFilter, sourceFilter, searchTerm]);

  const fetchOnboardingRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (departmentFilter !== 'all') params.append('department', departmentFilter);
      if (sourceFilter !== 'all') {
        // For hiring pipeline, we'll filter on the frontend since API doesn't support it yet
        // This can be enhanced later
      }
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/onboarding?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        // Filter out 100% completed onboarding requests (exclude those that are both 100% and status completed)
        let filteredRequests = (data.requests || []).filter((req: OnboardingRequest) => 
          !(req.progressPercentage === 100 && req.status === 'completed')
        );
        
        // Apply source filter
        if (sourceFilter === 'hiring_pipeline') {
          filteredRequests = filteredRequests.filter((req: OnboardingRequest) => 
            req.candidateId || req.source === 'hiring_pipeline'
          );
        } else if (sourceFilter === 'manual') {
          filteredRequests = filteredRequests.filter((req: OnboardingRequest) => 
            !req.candidateId && req.source !== 'hiring_pipeline'
          );
        }
        
        setRequests(filteredRequests);
        setCounts(data.counts || {});
        
        // Extract unique departments
        const uniqueDepartments = new Set<string>();
        data.requests?.forEach((req: OnboardingRequest) => {
          if (req.department) uniqueDepartments.add(req.department);
        });
        setDepartments(Array.from(uniqueDepartments));
      } else {
        const error = await response.json();
        toast.error(formatErrorMessage(error.error, 'Failed to fetch onboarding requests'));
      }
    } catch (error) {
      console.error('Error fetching onboarding requests:', error);
      toast.error('Failed to fetch onboarding requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        const managerEmployees = data.filter((emp: any) => 
          emp.role?.toLowerCase().includes('manager') || emp.role?.toLowerCase().includes('mgr')
        );
        setManagers(managerEmployees);
      }
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const handleCreateOnboarding = async () => {
    try {
      // Validation
      if (!createFormData.email || !createFormData.firstName || !createFormData.lastName || !createFormData.dateOfJoining) {
        toast.error('Please fill in all required fields');
        return;
      }

      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createFormData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Onboarding request created successfully');
        setIsCreateDialogOpen(false);
        resetCreateForm();
        fetchOnboardingRequests();
        
        // Show onboarding link
        if (data.onboardingLink) {
          toast.info(`Onboarding Link: ${data.onboardingLink}`, {
            duration: 10000,
            action: {
              label: 'Copy',
              onClick: () => {
                navigator.clipboard.writeText(data.onboardingLink);
                toast.success('Link copied to clipboard');
              },
            },
          });
        }
      } else {
        toast.error(formatErrorMessage(data.error, 'Failed to create onboarding request'));
      }
    } catch (error: any) {
      console.error('Error creating onboarding request:', error);
      toast.error(formatErrorMessage(error, 'Failed to create onboarding request'));
    }
  };

  const handleAction = async (request: OnboardingRequest, action: 'approve' | 'reject' | 'request_changes' | 'view' | 'delete' | 'view_candidate') => {
    setSelectedRequest(request);
    setActionType(action);
    
    if (action === 'view') {
      // Navigate to onboarding form page with token
      window.location.href = `/onboarding/${request.token}`;
      return;
    }

    if (action === 'view_candidate') {
      // Navigate to candidate details in hiring pipeline
      if (request.candidateId) {
        window.open(`/dashboard/hr/candidates?candidateId=${request.candidateId}`, '_blank');
      }
      return;
    }

    if (action === 'delete') {
      // Confirm deletion
      if (!confirm(`Are you sure you want to delete the onboarding request for ${request.firstName} ${request.lastName}? This action cannot be undone.`)) {
        return;
      }

      try {
        const response = await fetch(`/api/onboarding/${request._id}`, {
          method: 'DELETE',
        });

        const data = await response.json();

        if (response.ok) {
          toast.success('Onboarding request deleted successfully');
          fetchOnboardingRequests();
        } else {
          toast.error(formatErrorMessage(data.error, 'Failed to delete onboarding request'));
        }
      } catch (error: any) {
        toast.error(formatErrorMessage(error, 'Failed to delete onboarding request'));
      }
      return;
    }

    if (action === 'approve') {
      // Direct approval
      try {
        const response = await fetch(`/api/onboarding/${request._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve' }),
        });

        const data = await response.json();

        if (response.ok) {
          toast.success('Onboarding approved successfully');
          if (data.employeeId && data.defaultPassword) {
            toast.info(`Employee ID: ${data.employeeId}, Default Password: ${data.defaultPassword}`, {
              duration: 10000,
            });
          }
          fetchOnboardingRequests();
        } else {
          toast.error(formatErrorMessage(data.error, 'Failed to approve onboarding'));
        }
      } catch (error: any) {
        toast.error(formatErrorMessage(error, 'Failed to approve onboarding'));
      }
    } else {
      // Reject or request changes - need comments
      setIsActionDialogOpen(true);
    }
  };

  const handleSubmitAction = async () => {
    if (!selectedRequest || !actionType) return;

    try {
      let body: any = { action: actionType };
      
      if (actionType === 'reject') {
        if (!actionFormData.rejectionReason) {
          toast.error('Rejection reason is required');
          return;
        }
        body.rejectionReason = actionFormData.rejectionReason;
      } else if (actionType === 'request_changes') {
        if (!actionFormData.changeRequestComments) {
          toast.error('Change request comments are required');
          return;
        }
        body.changeRequestComments = actionFormData.changeRequestComments;
      }

      const response = await fetch(`/api/onboarding/${selectedRequest._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          actionType === 'reject'
            ? 'Onboarding rejected successfully'
            : 'Changes requested successfully'
        );
        setIsActionDialogOpen(false);
        setActionFormData({ rejectionReason: '', changeRequestComments: '' });
        fetchOnboardingRequests();
      } else {
        toast.error(formatErrorMessage(data.error, 'Action failed'));
      }
    } catch (error: any) {
      toast.error(formatErrorMessage(error, 'Action failed'));
    }
  };

  const handleSendReminder = async (request: OnboardingRequest) => {
    try {
      const response = await fetch(`/api/onboarding/${request._id}/reminder`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Reminder sent successfully');
        if (data.onboardingLink) {
          toast.info(`Onboarding Link: ${data.onboardingLink}`, {
            duration: 5000,
            action: {
              label: 'Copy',
              onClick: () => {
                navigator.clipboard.writeText(data.onboardingLink);
                toast.success('Link copied');
              },
            },
          });
        }
        fetchOnboardingRequests();
      } else {
        toast.error(formatErrorMessage(data.error, 'Failed to send reminder'));
      }
    } catch (error: any) {
      toast.error(formatErrorMessage(error, 'Failed to send reminder'));
    }
  };

  const handleRegenerateToken = async (request: OnboardingRequest) => {
    try {
      const response = await fetch(`/api/onboarding/${request._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_token', expiryDays: 30 }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Token regenerated successfully');
        if (data.onboardingLink) {
          toast.info(`New Onboarding Link: ${data.onboardingLink}`, {
            duration: 10000,
            action: {
              label: 'Copy',
              onClick: () => {
                navigator.clipboard.writeText(data.onboardingLink);
                toast.success('Link copied');
              },
            },
          });
        }
        fetchOnboardingRequests();
      } else {
        toast.error(formatErrorMessage(data.error, 'Failed to regenerate token'));
      }
    } catch (error: any) {
      toast.error(formatErrorMessage(error, 'Failed to regenerate token'));
    }
  };

  const resetCreateForm = () => {
    setCreateFormData({
      email: '',
      personalEmail: '',
      mobileNumber: '',
      firstName: '',
      lastName: '',
      dateOfJoining: new Date().toISOString().split('T')[0],
      department: '',
      designation: '',
      reportingManagerId: '',
      workLocation: '',
      requiresManagerAck: false,
      expiryDays: 30,
      hrNotes: '',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'invited':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'submitted':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'changes_requested':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Employee Onboarding</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage employee onboarding requests and track progress</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} size="sm" className="w-full sm:w-auto">
          <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          <span className="text-xs sm:text-sm">Create Onboarding Request</span>
        </Button>
      </div>

      {/* Hiring Pipeline Integration Info */}
      {(requests.some(r => r.candidateId || r.source === 'hiring_pipeline')) && (
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm sm:text-base mb-1">Hiring Pipeline Integration</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Some onboarding requests were automatically created from accepted offers in the hiring pipeline. 
                  You can view the candidate details and offer information for these requests.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards - Compact and Scrollable */}
      <div className="overflow-x-auto -mx-3 px-3 pb-2" style={{ scrollbarWidth: 'thin' }}>
        <div className="grid gap-2 sm:gap-3 grid-cols-7 min-w-max">
        <Card className="min-w-[100px] sm:min-w-[110px]">
          <CardHeader className="pb-1.5 sm:pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">Invited</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{counts.invited || 0}</p>
          </CardContent>
        </Card>
        <Card className="min-w-[100px] sm:min-w-[110px]">
          <CardHeader className="pb-1.5 sm:pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">In Progress</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{counts.in_progress || 0}</p>
          </CardContent>
        </Card>
        <Card className="min-w-[100px] sm:min-w-[110px]">
          <CardHeader className="pb-1.5 sm:pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">Submitted</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{counts.submitted || 0}</p>
          </CardContent>
        </Card>
        <Card className="min-w-[100px] sm:min-w-[110px]">
          <CardHeader className="pb-1.5 sm:pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">Changes</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{counts.changes_requested || 0}</p>
          </CardContent>
        </Card>
        <Card className="min-w-[100px] sm:min-w-[110px]">
          <CardHeader className="pb-1.5 sm:pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">Approved</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{counts.approved || 0}</p>
          </CardContent>
        </Card>
        <Card className="min-w-[100px] sm:min-w-[110px]">
          <CardHeader className="pb-1.5 sm:pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">Rejected</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{counts.rejected || 0}</p>
          </CardContent>
        </Card>
        <Card className="min-w-[100px] sm:min-w-[110px]">
          <CardHeader className="pb-1.5 sm:pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">Completed</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{counts.completed || 0}</p>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="changes_requested">Changes Requested</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="hiring_pipeline">From Hiring Pipeline</SelectItem>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 md:col-span-2">
              <Label className="text-xs sm:text-sm">Search</Label>
              <Input
                placeholder="Search by name, email, or onboarding ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-xs sm:text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Requests</CardTitle>
          <CardDescription>{requests.length} request(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No onboarding requests found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request._id}
                  className="border rounded-lg p-3 sm:p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-4">
                    <div className="flex-1 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="font-semibold text-sm sm:text-base">
                          {request.firstName} {request.lastName}
                        </h3>
                        <Badge className={getStatusColor(request.status)}>
                          <span className="text-xs">{request.status.replace('_', ' ')}</span>
                        </Badge>
                        {(request.candidateId || request.source === 'hiring_pipeline') && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-300 dark:border-green-800">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            <span className="text-xs">From Hiring</span>
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px] sm:max-w-none" title={request.onboardingId}>
                          {request.onboardingId}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Email:</span>
                          <span className="truncate max-w-[200px]">{request.email}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Joining:</span>
                          <span>{formatDate(request.dateOfJoining)}</span>
                        </div>
                        {request.department && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Dept:</span>
                            <span>{request.department}</span>
                          </div>
                        )}
                        {request.designation && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Role:</span>
                            <span className="truncate max-w-[120px]">{request.designation}</span>
                          </div>
                        )}
                        {request.candidate?.candidateId && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Candidate:</span>
                            <span className="font-mono text-xs">{request.candidate.candidateId}</span>
                          </div>
                        )}
                      </div>
                      {request.candidate?.jobRequisitionId && (
                        <div className="mt-1.5 text-xs text-muted-foreground">
                          <span className="font-medium">Position:</span> {request.candidate.jobRequisitionId.jobTitle}
                          {request.candidate.jobRequisitionId.department && ` • ${request.candidate.jobRequisitionId.department}`}
                        </div>
                      )}
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Progress:</span>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 max-w-[150px] sm:max-w-xs">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${request.progressPercentage}%` }}
                            />
                          </div>
                          <span className="text-xs sm:text-sm font-medium">{request.progressPercentage}%</span>
                        </div>
                      </div>
                      {request.rejectionReason && (
                        <div className="mt-2 p-1.5 sm:p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs sm:text-sm">
                          <span className="font-medium">Rejection:</span> <span className="line-clamp-1">{request.rejectionReason}</span>
                        </div>
                      )}
                      {request.changeRequestComments && (
                        <div className="mt-2 p-1.5 sm:p-2 bg-orange-50 dark:bg-orange-900/20 rounded text-xs sm:text-sm">
                          <span className="font-medium">Changes:</span> <span className="line-clamp-1">{request.changeRequestComments}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-row gap-1.5 sm:gap-2 w-full sm:w-auto sm:ml-4 flex-wrap sm:flex-nowrap">
                      {(request.candidateId || request.source === 'hiring_pipeline') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(request, 'view_candidate')}
                          className="text-xs"
                          title="View candidate in hiring pipeline"
                        >
                          <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          <span className="hidden xs:inline">View Candidate</span>
                          <span className="xs:hidden">Candidate</span>
                        </Button>
                      )}
                      {request.status === 'submitted' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(request, 'view')}
                            className="text-xs"
                          >
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="hidden xs:inline">View</span>
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAction(request, 'approve')}
                            className="text-xs"
                          >
                            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="hidden xs:inline">Approve</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(request, 'request_changes')}
                          >
                            <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="hidden xs:inline">Request Changes</span>
                            <span className="xs:hidden">Changes</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleAction(request, 'reject')}
                          >
                            <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="hidden xs:inline">Reject</span>
                          </Button>
                        </>
                      )}
                      {(request.status === 'invited' || request.status === 'in_progress') && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendReminder(request)}
                          >
                            <Send className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="hidden sm:inline">Send Reminder ({request.reminderCount || 0})</span>
                            <span className="sm:hidden">Remind</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRegenerateToken(request)}
                          >
                            <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="hidden sm:inline">Regenerate Link</span>
                            <span className="sm:hidden">Regenerate</span>
                          </Button>
                        </>
                      )}
                      {request.status === 'changes_requested' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(request, 'view')}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      )}
                      {/* Delete button - available for all statuses */}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleAction(request, 'delete')}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Onboarding Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Create Onboarding Request</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Initiate onboarding for a new employee</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label>First Name *</Label>
                <Input
                  value={createFormData.firstName}
                  onChange={(e) => setCreateFormData({ ...createFormData, firstName: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input
                  value={createFormData.lastName}
                  onChange={(e) => setCreateFormData({ ...createFormData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Company Email *</Label>
              <Input
                type="email"
                value={createFormData.email}
                onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Personal Email</Label>
              <Input
                type="email"
                value={createFormData.personalEmail}
                onChange={(e) => setCreateFormData({ ...createFormData, personalEmail: e.target.value })}
              />
            </div>
            <div>
              <Label>Mobile Number</Label>
              <Input
                value={createFormData.mobileNumber}
                onChange={(e) => setCreateFormData({ ...createFormData, mobileNumber: e.target.value })}
              />
            </div>
            <div>
              <Label>Date of Joining *</Label>
              <Input
                type="date"
                value={createFormData.dateOfJoining}
                onChange={(e) => setCreateFormData({ ...createFormData, dateOfJoining: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Department</Label>
                <Input
                  value={createFormData.department}
                  onChange={(e) => setCreateFormData({ ...createFormData, department: e.target.value })}
                />
              </div>
              <div>
                <Label>Designation</Label>
                <Input
                  value={createFormData.designation}
                  onChange={(e) => setCreateFormData({ ...createFormData, designation: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Reporting Manager</Label>
              <Select
                value={createFormData.reportingManagerId || 'none'}
                onValueChange={(value) => setCreateFormData({ ...createFormData, reportingManagerId: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {managers.map((mgr) => (
                    <SelectItem key={mgr._id} value={mgr._id}>
                      {mgr.name} ({mgr.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Work Location</Label>
              <Input
                value={createFormData.workLocation}
                onChange={(e) => setCreateFormData({ ...createFormData, workLocation: e.target.value })}
              />
            </div>
            <div>
              <Label>Token Expiry (Days)</Label>
              <Input
                type="number"
                min="1"
                max="90"
                value={createFormData.expiryDays}
                onChange={(e) => setCreateFormData({ ...createFormData, expiryDays: parseInt(e.target.value) || 30 })}
              />
            </div>
            <div>
              <Label>HR Notes</Label>
              <Textarea
                value={createFormData.hrNotes}
                onChange={(e) => setCreateFormData({ ...createFormData, hrNotes: e.target.value })}
                placeholder="Internal notes (not visible to employee)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              resetCreateForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateOnboarding}>
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog (Reject/Request Changes) */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {actionType === 'reject'
                ? 'Reject Onboarding'
                : actionType === 'request_changes'
                ? 'Request Changes'
                : 'Onboarding Details'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {actionType === 'reject'
                ? 'Please provide a reason for rejection'
                : actionType === 'request_changes'
                ? 'Please specify what changes are needed'
                : 'View onboarding submission details'}
            </DialogDescription>
          </DialogHeader>
          {actionType === 'view' ? (
            <div className="space-y-4">
              {selectedRequest && (
                <div className="space-y-2 text-sm">
                  <p><strong>Name:</strong> {selectedRequest.firstName} {selectedRequest.lastName}</p>
                  <p><strong>Email:</strong> {selectedRequest.email}</p>
                  <p><strong>Status:</strong> {selectedRequest.status}</p>
                  <p><strong>Progress:</strong> {selectedRequest.progressPercentage}%</p>
                  {selectedRequest.rejectionReason && (
                    <p><strong>Rejection Reason:</strong> {selectedRequest.rejectionReason}</p>
                  )}
                  {selectedRequest.changeRequestComments && (
                    <p><strong>Change Request:</strong> {selectedRequest.changeRequestComments}</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>
                  {actionType === 'reject' ? 'Rejection Reason *' : 'Change Request Comments *'}
                </Label>
                <Textarea
                  value={actionType === 'reject' ? actionFormData.rejectionReason : actionFormData.changeRequestComments}
                  onChange={(e) =>
                    setActionFormData({
                      ...actionFormData,
                      [actionType === 'reject' ? 'rejectionReason' : 'changeRequestComments']: e.target.value,
                    })
                  }
                  placeholder={
                    actionType === 'reject'
                      ? 'Explain why this onboarding is being rejected...'
                      : 'Specify what changes are needed...'
                  }
                  required
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsActionDialogOpen(false);
              setActionFormData({ rejectionReason: '', changeRequestComments: '' });
            }}>
              Cancel
            </Button>
            {actionType !== 'view' && (
              <Button onClick={handleSubmitAction}>
                {actionType === 'reject' ? 'Reject' : 'Request Changes'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
