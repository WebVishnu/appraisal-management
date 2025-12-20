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
import { CreatableSelect } from '@/components/ui/creatable-select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus,
  Calendar,
  Clock,
  Video,
  Phone,
  MapPin,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
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
import FeedbackFormDialog from './feedback-form-dialog';

interface Interview {
  _id: string;
  interviewId: string;
  candidateId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    candidateId: string;
  };
  roundName: string;
  roundOrder: number;
  scheduledStartTime: string;
  scheduledEndTime: string;
  mode: 'in_person' | 'video' | 'telephonic';
  location?: string;
  interviewLink?: string;
  status: string;
  primaryInterviewerId?: {
    _id: string;
    email: string;
  };
}

export default function InterviewsTab() {
  const [loading, setLoading] = useState(true);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [candidates, setCandidates] = useState<Array<{ _id: string; firstName: string; lastName: string; candidateId: string }>>([]);
  const [users, setUsers] = useState<Array<{ _id: string; email: string }>>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [isCancellationDialogOpen, setIsCancellationDialogOpen] = useState(false);
  const [selectedInterviewForFeedback, setSelectedInterviewForFeedback] = useState<Interview | null>(null);
  const [selectedInterviewForCancellation, setSelectedInterviewForCancellation] = useState<Interview | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const [formData, setFormData] = useState({
    candidateId: '',
    roundName: '',
    roundOrder: 1,
    roundType: 'technical' as 'technical' | 'hr' | 'manager' | 'final',
    scheduledStartTime: '',
    scheduledEndTime: '',
    mode: 'video' as 'in_person' | 'video' | 'telephonic',
    location: '',
    interviewLink: '',
    meetingId: '',
    meetingPassword: '',
    interviewers: [] as string[],
    primaryInterviewerId: '',
    interviewNotes: '',
  });

  useEffect(() => {
    fetchInterviews();
    fetchCandidates();
    fetchUsers();
  }, [statusFilter, dateFilter]);

  const fetchInterviews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (dateFilter) {
        const startDate = new Date(dateFilter);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
      }

      const response = await fetch(`/api/interviews/interviews?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setInterviews(data);
      } else {
        toast.error('Failed to fetch interviews');
      }
    } catch (error) {
      console.error('Error fetching interviews:', error);
      toast.error('Error fetching interviews');
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidates = async () => {
    try {
      // Fetch ALL candidates (not filtered by status)
      const response = await fetch('/api/interviews/candidates');
      if (response.ok) {
        const data = await response.json();
        // Filter out only rejected and withdrawn candidates
        const activeCandidates = data.filter((c: any) => 
          c.status !== 'rejected' && 
          c.status !== 'withdrawn' && 
          c.status !== 'selected' &&
          c.isActive !== false
        );
        setCandidates(activeCandidates);
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        // Include all users (hr, manager, super_admin) as potential interviewers
        // Filter to only active users
        const activeUsers = data.filter((user: any) => user.isActive !== false);
        setUsers(activeUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.candidateId || !formData.roundName || !formData.scheduledStartTime || !formData.primaryInterviewerId) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Prepare data - remove empty strings for optional fields
      const requestData: any = {
        ...formData,
        interviewers: formData.interviewers.length > 0 ? formData.interviewers : [formData.primaryInterviewerId],
      };
      
      // Remove empty optional fields
      if (!requestData.interviewLink || requestData.interviewLink.trim() === '') {
        delete requestData.interviewLink;
      }
      if (!requestData.location || requestData.location.trim() === '') {
        delete requestData.location;
      }
      if (!requestData.meetingId || requestData.meetingId.trim() === '') {
        delete requestData.meetingId;
      }
      if (!requestData.meetingPassword || requestData.meetingPassword.trim() === '') {
        delete requestData.meetingPassword;
      }
      if (!requestData.interviewNotes || requestData.interviewNotes.trim() === '') {
        delete requestData.interviewNotes;
      }

      const response = await fetch('/api/interviews/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Interview scheduled successfully. Candidate status updated to "Interview Scheduled".');
        setIsCreateDialogOpen(false);
        resetForm();
        fetchInterviews();
        fetchCandidates(); // Refresh candidates to show updated status
      } else {
        toast.error(formatErrorMessage(data.error, 'Failed to schedule interview'));
      }
    } catch (error: any) {
      console.error('Error scheduling interview:', error);
      toast.error(formatErrorMessage(error, 'Failed to schedule interview'));
    }
  };

  const handleStatusUpdate = async (interviewId: string, newStatus: string) => {
    const interview = interviews.find((i) => i._id === interviewId);
    if (!interview) return;

    // If changing to completed, show feedback dialog
    if (newStatus === 'completed') {
      setSelectedInterviewForFeedback(interview);
      setIsFeedbackDialogOpen(true);
      return;
    }

    // If changing to cancelled, show cancellation reason dialog
    if (newStatus === 'cancelled') {
      setSelectedInterviewForCancellation(interview);
      setIsCancellationDialogOpen(true);
      return;
    }

    // For other status changes, update directly
    await updateInterviewStatus(interviewId, newStatus);
  };

  const updateInterviewStatus = async (interviewId: string, newStatus: string, cancellationReason?: string) => {
    try {
      const body: any = {
        id: interviewId,
        status: newStatus,
      };
      
      if (cancellationReason) {
        body.cancellationReason = cancellationReason;
      }

      const response = await fetch('/api/interviews/interviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Interview status updated successfully');
        fetchInterviews();
        // Trigger feedback tab refresh by dispatching custom event
        window.dispatchEvent(new CustomEvent('refreshFeedbackTab'));
      } else {
        toast.error(formatErrorMessage(data.error, 'Failed to update status'));
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(formatErrorMessage(error, 'Failed to update status'));
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!selectedInterviewForFeedback) return;
    
    // Status will be updated when feedback is submitted
    // Just close the dialog and refresh
    setIsFeedbackDialogOpen(false);
    setSelectedInterviewForFeedback(null);
    fetchInterviews();
  };

  const handleCancellationSubmit = async () => {
    if (!selectedInterviewForCancellation || !cancellationReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }

    await updateInterviewStatus(selectedInterviewForCancellation._id, 'cancelled', cancellationReason);
    setIsCancellationDialogOpen(false);
    setSelectedInterviewForCancellation(null);
    setCancellationReason('');
  };

  const resetForm = () => {
    setFormData({
      candidateId: '',
      roundName: '',
      roundOrder: 1,
      roundType: 'technical',
      scheduledStartTime: '',
      scheduledEndTime: '',
      mode: 'video',
      location: '',
      interviewLink: '',
      meetingId: '',
      meetingPassword: '',
      interviewers: [],
      primaryInterviewerId: '',
      interviewNotes: '',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'no_show':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'telephonic':
        return <Phone className="h-4 w-4" />;
      case 'in_person':
        return <MapPin className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Interviews</h2>
          <p className="text-sm text-muted-foreground">Schedule and manage interviews</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Schedule Interview
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
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interviews Table */}
      <Card>
        <CardHeader>
          <CardTitle>Interviews</CardTitle>
          <CardDescription>{interviews.length} interview(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {interviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No interviews found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Interview ID</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Interviewer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interviews.map((interview) => (
                    <TableRow key={interview._id}>
                      <TableCell className="font-mono text-xs">{interview.interviewId}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {interview.candidateId.firstName} {interview.candidateId.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{interview.candidateId.candidateId}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{interview.roundName}</p>
                          <p className="text-xs text-muted-foreground">Round {interview.roundOrder}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{formatDate(interview.scheduledStartTime)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(interview.scheduledStartTime).toLocaleTimeString()} - {new Date(interview.scheduledEndTime).toLocaleTimeString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getModeIcon(interview.mode)}
                          <span className="text-sm capitalize">{interview.mode.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {interview.primaryInterviewerId?.email || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(interview.status)}>
                          {interview.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={interview.status}
                          onValueChange={(value) => handleStatusUpdate(interview._id, value)}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="no_show">No Show</SelectItem>
                          </SelectContent>
                        </Select>
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
            <DialogTitle>Schedule Interview</DialogTitle>
            <DialogDescription>Schedule a new interview for a candidate</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Candidate *</Label>
              <Select
                value={formData.candidateId}
                onValueChange={(value) => setFormData({ ...formData, candidateId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No candidates available. Please add candidates first.
                    </div>
                  ) : (
                    candidates.map((candidate) => (
                      <SelectItem key={candidate._id} value={candidate._id}>
                        {candidate.firstName} {candidate.lastName} ({candidate.candidateId})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {candidates.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No active candidates found. Add candidates in the Candidates tab first.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Round Name *</Label>
                <Input
                  value={formData.roundName}
                  onChange={(e) => setFormData({ ...formData, roundName: e.target.value })}
                  placeholder="e.g., Technical Round"
                  required
                />
              </div>
              <div>
                <Label>Round Order *</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.roundOrder}
                  onChange={(e) => setFormData({ ...formData, roundOrder: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time *</Label>
                <Input
                  type="datetime-local"
                  value={formData.scheduledStartTime}
                  onChange={(e) => {
                    setFormData({ ...formData, scheduledStartTime: e.target.value });
                    // Auto-set end time (1 hour later)
                    if (e.target.value) {
                      const start = new Date(e.target.value);
                      start.setHours(start.getHours() + 1);
                      setFormData(prev => ({
                        ...prev,
                        scheduledStartTime: e.target.value,
                        scheduledEndTime: start.toISOString().slice(0, 16),
                      }));
                    }
                  }}
                  required
                />
              </div>
              <div>
                <Label>End Time *</Label>
                <Input
                  type="datetime-local"
                  value={formData.scheduledEndTime}
                  onChange={(e) => setFormData({ ...formData, scheduledEndTime: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Mode *</Label>
              <Select
                value={formData.mode}
                onValueChange={(value: any) => setFormData({ ...formData, mode: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="in_person">In Person</SelectItem>
                  <SelectItem value="telephonic">Telephonic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.mode === 'video' && (
              <div>
                <Label>Interview Link</Label>
                <Input
                  value={formData.interviewLink}
                  onChange={(e) => setFormData({ ...formData, interviewLink: e.target.value })}
                  placeholder="https://meet.google.com/..."
                />
              </div>
            )}
            {formData.mode === 'in_person' && (
              <div>
                <Label>Location</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Office address or room number"
                />
              </div>
            )}
            <div>
              <Label>Primary Interviewer *</Label>
              <CreatableSelect
                key={users.length} // Force re-render when users list changes
                options={users.map((user) => ({
                  value: user._id,
                  label: user.email,
                }))}
                value={formData.primaryInterviewerId}
                onValueChange={(value) => setFormData({ ...formData, primaryInterviewerId: value })}
                placeholder="Select or create interviewer..."
                createLabel="Create New Interviewer"
                inputLabel="Email"
                inputPlaceholder="Enter interviewer email address"
                onCreate={async (email) => {
                  try {
                    // Validate email format
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(email)) {
                      toast.error('Please enter a valid email address');
                      throw new Error('Invalid email format');
                    }

                    // Create a new user with manager role (interviewers are typically managers)
                    const randomPassword = Math.floor(1000000 + Math.random() * 9000000).toString();
                    const response = await fetch('/api/users', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        email: email.trim().toLowerCase(),
                        password: randomPassword,
                        role: 'manager', // Interviewers are typically managers
                      }),
                    });

                    const data = await response.json();

                    if (response.ok) {
                      toast.success(`Interviewer created successfully. Password: ${randomPassword}`, {
                        duration: 10000,
                      });
                      // Refresh users list - wait for it to complete
                      await fetchUsers();
                      // Small delay to ensure state is updated
                      await new Promise(resolve => setTimeout(resolve, 100));
                      // Return the new user ID
                      return data._id;
                    } else {
                      const errorMsg = typeof data.error === 'string' ? data.error : 'Failed to create interviewer';
                      toast.error(errorMsg);
                      throw new Error(errorMsg);
                    }
                  } catch (error: any) {
                    console.error('Error creating interviewer:', error);
                    if (!error.message.includes('Invalid email')) {
                      toast.error(formatErrorMessage(error, 'Failed to create interviewer'));
                    }
                    throw error;
                  }
                }}
              />
            </div>
            <div>
              <Label>Interview Notes</Label>
              <Textarea
                value={formData.interviewNotes}
                onChange={(e) => setFormData({ ...formData, interviewNotes: e.target.value })}
                rows={3}
                placeholder="Any special instructions or notes..."
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
            <Button onClick={handleCreate}>Schedule Interview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      {selectedInterviewForFeedback && (
        <FeedbackFormDialog
          open={isFeedbackDialogOpen}
          onOpenChange={(open) => {
            setIsFeedbackDialogOpen(open);
            if (!open) {
              setSelectedInterviewForFeedback(null);
            }
          }}
          interviewId={selectedInterviewForFeedback._id}
          candidateName={`${selectedInterviewForFeedback.candidateId.firstName} ${selectedInterviewForFeedback.candidateId.lastName}`}
          roundName={selectedInterviewForFeedback.roundName}
          onSuccess={handleFeedbackSubmit}
        />
      )}

      {/* Cancellation Reason Dialog */}
      <Dialog open={isCancellationDialogOpen} onOpenChange={setIsCancellationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Interview</DialogTitle>
            <DialogDescription>
              Please provide a reason for cancelling this interview
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Candidate</Label>
              <p className="text-sm text-muted-foreground">
                {selectedInterviewForCancellation?.candidateId.firstName}{' '}
                {selectedInterviewForCancellation?.candidateId.lastName} -{' '}
                {selectedInterviewForCancellation?.roundName}
              </p>
            </div>
            <div>
              <Label>Cancellation Reason *</Label>
              <Textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Enter the reason for cancellation..."
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCancellationDialogOpen(false);
                setSelectedInterviewForCancellation(null);
                setCancellationReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCancellationSubmit}
              disabled={!cancellationReason.trim()}
            >
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

