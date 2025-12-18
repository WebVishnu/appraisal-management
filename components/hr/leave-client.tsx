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
import { toast } from 'sonner';
import { Calendar, Edit, Plus, Search, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { getStatusColor } from '@/lib/utils/leave';
import { SkeletonCard } from '@/components/shared/skeleton-loader';
import { Textarea } from '@/components/ui/textarea';

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

interface Employee {
  _id: string;
  name: string;
  employeeId: string;
  email: string;
}

interface LeaveBalance {
  [key: string]: {
    total: number;
    used: number;
    available: number;
  };
}

export default function HRLeaveClient() {
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [selectedEmployeeForBalance, setSelectedEmployeeForBalance] = useState<Employee | null>(null);
  const [balanceData, setBalanceData] = useState<LeaveBalance>({});
  const [balanceFormData, setBalanceFormData] = useState({
    leaveType: '',
    totalDays: 0,
    notes: '',
  });
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      toast.error('Failed to fetch employees');
    }
  };

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedEmployee && selectedEmployee !== 'all') {
        params.append('employeeId', selectedEmployee);
      }
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

  const fetchBalance = async (employeeId: string) => {
    try {
      const response = await fetch(`/api/leaves/balance?employeeId=${employeeId}`);
      if (response.ok) {
        const data = await response.json();
        setBalanceData(data.balance || {});
      }
    } catch (error) {
      toast.error('Failed to fetch leave balance');
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [selectedEmployee, statusFilter]);

  const handleOpenBalanceDialog = async (employee: Employee) => {
    setSelectedEmployeeForBalance(employee);
    await fetchBalance(employee._id);
    setBalanceDialogOpen(true);
  };

  const handleUpdateBalance = async () => {
    if (!selectedEmployeeForBalance || !balanceFormData.leaveType) {
      toast.error('Please select leave type and enter total days');
      return;
    }

    try {
      const response = await fetch('/api/leaves/balance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployeeForBalance._id,
          leaveType: balanceFormData.leaveType,
          totalDays: balanceFormData.totalDays,
          notes: balanceFormData.notes,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Leave balance updated successfully');
        setBalanceDialogOpen(false);
        setBalanceFormData({ leaveType: '', totalDays: 0, notes: '' });
        await fetchBalance(selectedEmployeeForBalance._id);
      } else {
        toast.error(data.error || 'Failed to update leave balance');
      }
    } catch (error) {
      toast.error('Failed to update leave balance');
    }
  };

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">
            Leave Management
          </h1>
          <p className="text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-2">
            Manage organization-wide leave applications and balances
          </p>
        </div>
        <Button
          onClick={() => {
            // Open balance dialog with employee selector
            setSelectedEmployeeForBalance(null);
            setBalanceFormData({ leaveType: '', totalDays: 0, notes: '' });
            setBalanceDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Manage Employee Balance
        </Button>
      </div>

      {/* Leave Balance Management Section */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Balance Management</CardTitle>
          <CardDescription>View and update leave balances for any employee</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label>Select Employee</Label>
              <Select
                value={selectedEmployeeForBalance?._id || ''}
                onValueChange={(value) => {
                  const emp = employees.find(e => e._id === value);
                  if (emp) {
                    handleOpenBalanceDialog(emp);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee to manage balance" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp._id} value={emp._id}>
                      {emp.name} ({emp.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="pt-6">
              <Button
                onClick={() => {
                  if (selectedEmployeeForBalance) {
                    handleOpenBalanceDialog(selectedEmployeeForBalance);
                  } else {
                    toast.error('Please select an employee first');
                  }
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Manage Balance
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp._id} value={emp._id}>
                      {emp.name} ({emp.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                  placeholder="Search by name, ID, or reason..."
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
            <CardDescription>Leaves awaiting approval/rejection</CardDescription>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenBalanceDialog(leave.employeeId)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Balance
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Leave Applications */}
      <Card>
        <CardHeader>
          <CardTitle>All Leave Applications</CardTitle>
          <CardDescription>
            {filteredLeaves.length} application(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLeaves.length === 0 ? (
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenBalanceDialog(leave.employeeId)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Manage Balance
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Balance Management Dialog */}
      <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Leave Balance</DialogTitle>
            <DialogDescription>
              {selectedEmployeeForBalance
                ? `Update leave balance for ${selectedEmployeeForBalance.name}`
                : 'Select an employee to manage their leave balance'}
            </DialogDescription>
          </DialogHeader>
          {!selectedEmployeeForBalance ? (
            <div className="py-4">
              <Label>Select Employee</Label>
              <Select
                onValueChange={(value) => {
                  const emp = employees.find(e => e._id === value);
                  if (emp) {
                    handleOpenBalanceDialog(emp);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp._id} value={emp._id}>
                      {emp.name} ({emp.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              {/* Current Balance Display */}
              <div className="grid grid-cols-5 gap-2 p-4 bg-gray-50 dark:bg-[hsl(var(--muted))] rounded-lg">
                {['paid', 'unpaid', 'sick', 'casual', 'annual'].map((type) => (
                  <div key={type} className="text-center">
                    <div className="text-xs text-gray-500 dark:text-[hsl(var(--muted-foreground))] capitalize mb-1">
                      {type}
                    </div>
                    <div className="text-lg font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      {balanceData[type]?.available || 0}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-[hsl(var(--muted-foreground))]">
                      / {balanceData[type]?.total || 0}
                    </div>
                  </div>
                ))}
              </div>

              {/* Update Form */}
              <div className="space-y-4">
                <div>
                  <Label>Leave Type</Label>
                  <Select
                    value={balanceFormData.leaveType}
                    onValueChange={(value) =>
                      setBalanceFormData({ ...balanceFormData, leaveType: value })
                    }
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
                <div>
                  <Label>Total Days</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={balanceFormData.totalDays}
                    onChange={(e) =>
                      setBalanceFormData({
                        ...balanceFormData,
                        totalDays: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="Enter total allocated days"
                  />
                </div>
                <div>
                  <Label>Notes (Optional)</Label>
                  <Input
                    type="text"
                    value={balanceFormData.notes}
                    onChange={(e) =>
                      setBalanceFormData({ ...balanceFormData, notes: e.target.value })
                    }
                    placeholder="Add notes about this balance update..."
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBalanceDialogOpen(false);
                setSelectedEmployeeForBalance(null);
                setBalanceFormData({ leaveType: '', totalDays: 0, notes: '' });
              }}
            >
              Cancel
            </Button>
            {selectedEmployeeForBalance && (
              <Button onClick={handleUpdateBalance}>Update Balance</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog for Approve/Reject */}
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

