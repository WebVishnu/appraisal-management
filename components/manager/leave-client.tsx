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
import { toast } from 'sonner';
import { Calendar, CheckCircle, XCircle, AlertCircle, Search } from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { getStatusColor } from '@/lib/utils/leave';
import { SkeletonCard } from '@/components/shared/skeleton-loader';

interface Leave {
  _id: string;
  employeeId: {
    _id: string;
    name: string;
    employeeId: string;
    email: string;
  };
  leaveType: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  appliedBy: {
    email: string;
  };
  approvedBy?: {
    email: string;
  };
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export default function ManagerLeaveClient() {
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/leaves?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLeaves(data);
      } else {
        toast.error('Failed to fetch leaves');
      }
    } catch (error) {
      toast.error('Failed to fetch leaves');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [statusFilter]);

  const handleAction = (leave: Leave, actionType: 'approve' | 'reject') => {
    setSelectedLeave(leave);
    setAction(actionType);
    setRejectionReason('');
    setActionDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedLeave) return;

    if (action === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      const response = await fetch(`/api/leaves/${selectedLeave._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejectionReason: action === 'reject' ? rejectionReason : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Leave ${action}d successfully`);
        setActionDialogOpen(false);
        setSelectedLeave(null);
        fetchLeaves();
      } else {
        toast.error(data.error || `Failed to ${action} leave`);
      }
    } catch (error) {
      toast.error(`Failed to ${action} leave`);
    }
  };

  const filteredLeaves = leaves.filter((leave) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      leave.employeeId.name.toLowerCase().includes(search) ||
      leave.employeeId.employeeId.toLowerCase().includes(search) ||
      leave.employeeId.email.toLowerCase().includes(search) ||
      leave.reason.toLowerCase().includes(search)
    );
  });

  const pendingLeaves = filteredLeaves.filter((l) => l.status === 'pending');
  const otherLeaves = filteredLeaves.filter((l) => l.status !== 'pending');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">
          Team Leave Management
        </h1>
        <p className="text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-2">
          Review and approve/reject leave applications from your team
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by employee name, ID, or reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Leaves */}
      {pendingLeaves.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Pending Approvals ({pendingLeaves.length})
            </CardTitle>
            <CardDescription>Leaves awaiting your approval</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingLeaves.map((leave) => (
                <div
                  key={leave._id}
                  className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-[hsl(var(--muted))]"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                          {leave.employeeId.name}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                          ({leave.employeeId.employeeId})
                        </span>
                        <span className="font-medium text-gray-900 dark:text-[hsl(var(--foreground))] capitalize">
                          {leave.leaveType} Leave
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-[hsl(var(--muted-foreground))]">
                        <div className="flex items-center gap-4 mb-2">
                          <span>
                            <Calendar className="h-4 w-4 inline mr-1" />
                            {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                          </span>
                          <span>{leave.numberOfDays} day(s)</span>
                        </div>
                        <div className="mb-2">
                          <strong>Reason:</strong> {leave.reason}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                          Applied on {formatDate(leave.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAction(leave, 'approve')}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleAction(leave, 'reject')}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Leaves */}
      <Card>
        <CardHeader>
          <CardTitle>All Leave Applications</CardTitle>
          <CardDescription>Complete history of team leave applications</CardDescription>
        </CardHeader>
        <CardContent>
          {otherLeaves.length === 0 && pendingLeaves.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
              No leave applications found
            </div>
          ) : (
            <div className="space-y-4">
              {otherLeaves.map((leave) => (
                <div
                  key={leave._id}
                  className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-[hsl(var(--muted))]"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                          {leave.employeeId.name}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                          ({leave.employeeId.employeeId})
                        </span>
                        <span className="font-medium text-gray-900 dark:text-[hsl(var(--foreground))] capitalize">
                          {leave.leaveType} Leave
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(leave.status)}`}
                        >
                          {getStatusIcon(leave.status)}
                          {leave.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-[hsl(var(--muted-foreground))]">
                        <div className="flex items-center gap-4 mb-2">
                          <span>
                            <Calendar className="h-4 w-4 inline mr-1" />
                            {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                          </span>
                          <span>{leave.numberOfDays} day(s)</span>
                        </div>
                        <div className="mb-2">{leave.reason}</div>
                        {leave.rejectionReason && (
                          <div className="mb-2 text-red-600 dark:text-red-400">
                            Rejection reason: {leave.rejectionReason}
                          </div>
                        )}
                        {leave.approvedBy && (
                          <div className="text-xs text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                            {leave.status === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                            {leave.approvedBy.email} on {formatDate(leave.approvedAt || '')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' ? 'Approve Leave' : 'Reject Leave'}
            </DialogTitle>
            <DialogDescription>
              {action === 'approve'
                ? 'Are you sure you want to approve this leave application?'
                : 'Please provide a reason for rejecting this leave application.'}
            </DialogDescription>
          </DialogHeader>
          {selectedLeave && (
            <div className="py-4">
              <div className="mb-4 p-3 bg-gray-50 dark:bg-[hsl(var(--muted))] rounded-lg">
                <div className="text-sm">
                  <div className="font-semibold">{selectedLeave.employeeId.name}</div>
                  <div className="text-gray-600 dark:text-[hsl(var(--muted-foreground))]">
                    {formatDate(selectedLeave.startDate)} - {formatDate(selectedLeave.endDate)} (
                    {selectedLeave.numberOfDays} days)
                  </div>
                  <div className="text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-1">
                    {selectedLeave.reason}
                  </div>
                </div>
              </div>
              {action === 'reject' && (
                <div>
                  <Label>Rejection Reason</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAction}
              className={action === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

