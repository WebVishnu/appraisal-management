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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, Calendar, Search, Edit, Plus } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import { formatWorkingHours } from '@/lib/utils/attendance';
import { SkeletonCard } from '@/components/shared/skeleton-loader';

interface AttendanceRecord {
  _id: string;
  employeeId: {
    _id: string;
    name: string;
    employeeId: string;
    email: string;
  };
  date: string;
  checkIn: string;
  checkOut?: string;
  workingHours?: number;
  isLate: boolean;
  isEarlyExit: boolean;
  status: 'present' | 'absent' | 'half_day' | 'missed_checkout';
  notes?: string;
  correctedBy?: {
    email: string;
  };
  correctedAt?: string;
}

interface Employee {
  _id: string;
  name: string;
  employeeId: string;
  email: string;
}

export default function HRAttendanceClient() {
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [formData, setFormData] = useState<{
    employeeId: string;
    date: string;
    checkIn: string;
    checkOut: string;
    notes: string;
    status: 'present' | 'absent' | 'half_day' | 'missed_checkout';
  }>({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    checkIn: '',
    checkOut: '',
    notes: '',
    status: 'present',
  });

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

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      if (selectedEmployee && selectedEmployee !== 'all') {
        params.append('employeeId', selectedEmployee);
      }

      const response = await fetch(`/api/attendance?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAttendance(data);
      } else {
        toast.error('Failed to fetch attendance');
      }
    } catch (error) {
      toast.error('Failed to fetch attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [startDate, endDate, selectedEmployee]);

  const handleEdit = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setFormData({
      employeeId: record.employeeId._id,
      date: new Date(record.date).toISOString().split('T')[0],
      checkIn: new Date(record.checkIn).toISOString().slice(0, 16),
      checkOut: record.checkOut ? new Date(record.checkOut).toISOString().slice(0, 16) : '',
      notes: record.notes || '',
      status: record.status,
    });
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingRecord(null);
    setFormData({
      employeeId: '',
      date: new Date().toISOString().split('T')[0],
      checkIn: '',
      checkOut: '',
      notes: '',
      status: 'present',
    });
    setCreateDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingRecord) {
        // Update existing record
        const response = await fetch('/api/attendance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attendanceId: editingRecord._id,
            checkIn: formData.checkIn,
            checkOut: formData.checkOut || null,
            notes: formData.notes,
            status: formData.status,
          }),
        });

        if (response.ok) {
          toast.success('Attendance record updated successfully');
          setEditDialogOpen(false);
          fetchAttendance();
        } else {
          const data = await response.json();
          toast.error(data.error || 'Failed to update attendance');
        }
      } else {
        // Create new record
        const response = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: formData.employeeId,
            date: formData.date,
            checkIn: formData.checkIn,
            checkOut: formData.checkOut || null,
            notes: formData.notes,
            status: formData.status,
          }),
        });

        if (response.ok) {
          toast.success('Attendance record created successfully');
          setCreateDialogOpen(false);
          fetchAttendance();
        } else {
          const data = await response.json();
          toast.error(data.error || 'Failed to create attendance');
        }
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const filteredAttendance = attendance.filter((record) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      record.employeeId.name.toLowerCase().includes(search) ||
      record.employeeId.employeeId.toLowerCase().includes(search) ||
      record.employeeId.email.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (status: string, isLate: boolean, isEarlyExit: boolean) => {
    if (status === 'missed_checkout') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          Missed Checkout
        </span>
      );
    }
    if (status === 'half_day') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
          Half Day
        </span>
      );
    }
    if (status === 'absent') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          Absent
        </span>
      );
    }
    if (isLate || isEarlyExit) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          {isLate && isEarlyExit ? 'Late & Early' : isLate ? 'Late' : 'Early Exit'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        Present
      </span>
    );
  };

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">
            Attendance Management
          </h1>
          <p className="text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-2">
            View and manage organization-wide attendance records
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Record
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[hsl(var(--foreground))] mb-1">
                Employee
              </label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-[hsl(var(--foreground))] mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[hsl(var(--foreground))] mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-[hsl(var(--foreground))] mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name, ID, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Records */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
          <CardDescription>{filteredAttendance.length} record(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAttendance.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
              No attendance records found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      Employee
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      Check In
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      Check Out
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      Hours
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendance.map((record) => (
                    <tr
                      key={record._id}
                      className="border-b hover:bg-gray-50 dark:hover:bg-[hsl(var(--muted))]"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{record.employeeId.name}</div>
                          <div className="text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                            {record.employeeId.employeeId}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">{formatDate(record.date)}</td>
                      <td className="py-3 px-4">
                        {formatDateTime(record.checkIn)}
                        {record.isLate && (
                          <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                            (Late)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {record.checkOut ? (
                          <>
                            {formatDateTime(record.checkOut)}
                            {record.isEarlyExit && (
                              <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                                (Early)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {record.workingHours ? formatWorkingHours(record.workingHours) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(record.status, record.isLate, record.isEarlyExit)}
                        {record.correctedBy && (
                          <div className="text-xs text-gray-500 dark:text-[hsl(var(--muted-foreground))] mt-1">
                            Corrected by {record.correctedBy.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(record)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Attendance Record</DialogTitle>
            <DialogDescription>Update attendance details manually</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  disabled
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="missed_checkout">Missed Checkout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Check In</Label>
                <Input
                  type="datetime-local"
                  value={formData.checkIn}
                  onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                />
              </div>
              <div>
                <Label>Check Out</Label>
                <Input
                  type="datetime-local"
                  value={formData.checkOut}
                  onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any notes about this attendance record..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Attendance Record</DialogTitle>
            <DialogDescription>Manually create a new attendance record</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Employee</Label>
              <Select
                value={formData.employeeId}
                onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="missed_checkout">Missed Checkout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Check In</Label>
                <Input
                  type="datetime-local"
                  value={formData.checkIn}
                  onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Check Out (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={formData.checkOut}
                  onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any notes about this attendance record..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Create Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

