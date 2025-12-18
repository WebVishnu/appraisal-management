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
import { Calendar, Plus, Clock, XCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { getStatusColor } from '@/lib/utils/leave';
import { SkeletonCard } from '@/components/shared/skeleton-loader';

interface Leave {
  _id: string;
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

interface LeaveBalance {
  [key: string]: {
    total: number;
    used: number;
    available: number;
  };
}

export default function EmployeeLeaveClient() {
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [balance, setBalance] = useState<LeaveBalance>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const fetchLeaves = async () => {
    try {
      const response = await fetch('/api/leaves');
      if (response.ok) {
        const data = await response.json();
        setLeaves(data);
      }
    } catch (error) {
      toast.error('Failed to fetch leaves');
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/leaves/balance');
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance || {});
      }
    } catch (error) {
      toast.error('Failed to fetch leave balance');
    }
  };

  useEffect(() => {
    fetchLeaves();
    fetchBalance();
  }, []);

  const handleSubmit = async () => {
    if (!formData.leaveType || !formData.startDate || !formData.endDate || !formData.reason) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const response = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Leave application submitted successfully');
        setDialogOpen(false);
        setFormData({ leaveType: '', startDate: '', endDate: '', reason: '' });
        fetchLeaves();
        fetchBalance();
      } else {
        toast.error(data.error || 'Failed to submit leave application');
      }
    } catch (error) {
      toast.error('Failed to submit leave application');
    }
  };

  const handleCancel = async (leaveId: string) => {
    if (!confirm('Are you sure you want to cancel this leave?')) return;

    try {
      const response = await fetch(`/api/leaves/${leaveId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });

      if (response.ok) {
        toast.success('Leave cancelled successfully');
        fetchLeaves();
        fetchBalance();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to cancel leave');
      }
    } catch (error) {
      toast.error('Failed to cancel leave');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">
            Leave Management
          </h1>
          <p className="text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-2">
            Apply for leave and track your leave history
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Apply for Leave
        </Button>
      </div>

      {/* Leave Balance */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Balance</CardTitle>
          <CardDescription>Your available leave days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {['paid', 'unpaid', 'sick', 'casual', 'annual'].map((type) => (
              <div key={type} className="border rounded-lg p-4">
                <div className="text-sm font-medium text-gray-500 dark:text-[hsl(var(--muted-foreground))] capitalize">
                  {type} Leave
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">
                    {balance[type]?.available || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                    of {balance[type]?.total || 0} days
                  </div>
                  <div className="text-xs text-gray-400 dark:text-[hsl(var(--muted-foreground))] mt-1">
                    Used: {balance[type]?.used || 0} days
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leave History */}
      <Card>
        <CardHeader>
          <CardTitle>Leave History</CardTitle>
          <CardDescription>Your leave applications and status</CardDescription>
        </CardHeader>
        <CardContent>
          {leaves.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
              No leave applications found
            </div>
          ) : (
            <div className="space-y-4">
              {leaves.map((leave) => (
                <div
                  key={leave._id}
                  className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-[hsl(var(--muted))]"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-gray-900 dark:text-[hsl(var(--foreground))] capitalize">
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
                        <div className="flex items-center gap-4">
                          <span>
                            <Calendar className="h-4 w-4 inline mr-1" />
                            {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                          </span>
                          <span>{leave.numberOfDays} day(s)</span>
                        </div>
                        <div className="mt-2">{leave.reason}</div>
                        {leave.rejectionReason && (
                          <div className="mt-2 text-red-600 dark:text-red-400">
                            Rejection reason: {leave.rejectionReason}
                          </div>
                        )}
                        {leave.approvedBy && (
                          <div className="mt-2 text-xs text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                            {leave.status === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                            {leave.approvedBy.email} on {formatDate(leave.approvedAt || '')}
                          </div>
                        )}
                      </div>
                    </div>
                    {leave.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(leave._id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Apply Leave Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>Submit a new leave application</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Leave Type</Label>
              <Select
                value={formData.leaveType}
                onValueChange={(value) => setFormData({ ...formData, leaveType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid Leave</SelectItem>
                  <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="casual">Casual Leave</SelectItem>
                  <SelectItem value="annual">Annual Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Enter reason for leave..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Submit Application</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

