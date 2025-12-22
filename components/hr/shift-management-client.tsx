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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Calendar,
  Clock,
  Search,
  CheckCircle,
  XCircle,
  Briefcase,
  Coffee,
  Settings,
  BarChart3,
} from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { SkeletonCard } from '@/components/shared/skeleton-loader';
import BreakPoliciesTab from './break-policies-tab';

interface Shift {
  _id: string;
  name: string;
  shiftType: 'fixed' | 'rotational' | 'flexible';
  startTime: string;
  endTime: string;
  gracePeriod: number;
  earlyExitGracePeriod: number;
  minimumWorkingHours: number;
  breakDuration: number;
  isBreakPaid: boolean;
  workingDays: string[];
  isNightShift: boolean;
  isActive: boolean;
  description?: string;
}

interface ShiftAssignment {
  _id: string;
  shiftId: {
    _id: string;
    name: string;
  };
  assignmentType: 'permanent' | 'temporary';
  assignmentScope: 'employee' | 'team' | 'department';
  employeeId?: {
    _id: string;
    name: string;
    employeeId: string;
  } | null;
  teamManagerId?: {
    _id: string;
    name: string;
  };
  departmentRole?: string;
  startDate?: string;
  endDate?: string;
  effectiveDate: string;
  reason?: string;
  isActive: boolean;
}

interface Employee {
  _id: string;
  name: string;
  employeeId: string;
  email: string;
  isActive: boolean;
}

interface BreakPolicy {
  _id: string;
  name: string;
  description?: string;
  scope: 'global' | 'department' | 'role' | 'shift' | 'employee';
  scopeIds: string[];
  allowBreaks: boolean;
  maxBreaksPerDay?: number;
  maxTotalBreakDuration?: number;
  maxDurationPerBreak?: number;
  allowedBreakTypes: string[];
  mandatoryBreaks: string[];
  minWorkingHoursBeforeFirstBreak?: number;
  gracePeriod?: number;
  paidBreaks: string[];
  deductBreakTime: boolean;
  autoFlagExcessiveBreaks: boolean;
  allowBreakOverrun: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
  createdBy?: {
    email: string;
  };
}

export default function HRShiftManagementClient() {
  const [activeTab, setActiveTab] = useState('shifts');
  const [loading, setLoading] = useState(true);
  
  // Shifts state
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftFormData, setShiftFormData] = useState({
    name: '',
    shiftType: 'fixed' as 'fixed' | 'rotational' | 'flexible',
    startTime: '09:00',
    endTime: '18:00',
    gracePeriod: 15,
    earlyExitGracePeriod: 15,
    minimumWorkingHours: 480, // 8 hours in minutes
    breakDuration: 60,
    isBreakPaid: false,
    workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as string[],
    isNightShift: false,
    description: '',
  });

  // Assignments state
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignmentFormData, setAssignmentFormData] = useState({
    shiftId: '',
    assignmentType: 'permanent' as 'permanent' | 'temporary',
    assignmentScope: 'employee' as 'employee' | 'team' | 'department',
    employeeId: '',
    teamManagerId: '',
    departmentRole: '',
    startDate: '',
    endDate: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    reason: '',
  });

  // Roster state
  const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
  const [rosterFormData, setRosterFormData] = useState({
    employeeIds: [] as string[],
    shiftId: '',
    startDate: '',
    endDate: '',
    isWeeklyOff: false,
    notes: '',
  });

  // Break Policies state
  const [breakPolicies, setBreakPolicies] = useState<BreakPolicy[]>([]);
  const [breakPolicyDialogOpen, setBreakPolicyDialogOpen] = useState(false);
  const [editingBreakPolicy, setEditingBreakPolicy] = useState<BreakPolicy | null>(null);
  const [breakPolicyFormData, setBreakPolicyFormData] = useState<{
    name: string;
    description: string;
    scope: 'global' | 'department' | 'role' | 'shift' | 'employee';
    scopeIds: string[];
    allowBreaks: boolean;
    maxBreaksPerDay?: number;
    maxTotalBreakDuration?: number;
    maxDurationPerBreak?: number;
    allowedBreakTypes: string[];
    mandatoryBreaks: string[];
    minWorkingHoursBeforeFirstBreak?: number;
    gracePeriod?: number;
    paidBreaks: string[];
    deductBreakTime: boolean;
    autoFlagExcessiveBreaks: boolean;
    allowBreakOverrun: boolean;
    effectiveFrom: string;
    effectiveTo?: string;
    isActive: boolean;
  }>({
    name: '',
    description: '',
    scope: 'global',
    scopeIds: [],
    allowBreaks: true,
    maxBreaksPerDay: 3,
    maxTotalBreakDuration: 60,
    maxDurationPerBreak: 30,
    allowedBreakTypes: ['lunch', 'tea', 'personal'],
    mandatoryBreaks: [],
    minWorkingHoursBeforeFirstBreak: 2,
    gracePeriod: 5,
    paidBreaks: ['lunch'],
    deductBreakTime: true,
    autoFlagExcessiveBreaks: true,
    allowBreakOverrun: false,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
    isActive: true,
  });
  const [breakAnalytics, setBreakAnalytics] = useState<any>(null);

  useEffect(() => {
    fetchShifts();
    fetchAssignments();
    fetchEmployees();
    if (activeTab === 'break-policies') {
      fetchBreakPolicies();
      fetchBreakAnalytics();
    }
  }, [activeTab]);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/shifts?isActive=true');
      if (response.ok) {
        const data = await response.json();
        setShifts(data);
      }
    } catch (error) {
      toast.error('Failed to fetch shifts');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const response = await fetch('/api/shifts/assignments?isActive=true');
      if (response.ok) {
        const data = await response.json();
        setAssignments(data);
      }
    } catch (error) {
      toast.error('Failed to fetch assignments');
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.filter((e: Employee) => e.isActive));
      }
    } catch (error) {
      toast.error('Failed to fetch employees');
    }
  };

  const handleCreateShift = async () => {
    try {
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftFormData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Shift created successfully');
        setShiftDialogOpen(false);
        resetShiftForm();
        fetchShifts();
      } else {
        toast.error(data.error || 'Failed to create shift');
      }
    } catch (error) {
      toast.error('Failed to create shift');
    }
  };

  const handleUpdateShift = async () => {
    if (!editingShift) return;

    try {
      const response = await fetch(`/api/shifts/${editingShift._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftFormData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Shift updated successfully');
        setShiftDialogOpen(false);
        setEditingShift(null);
        resetShiftForm();
        fetchShifts();
      } else {
        toast.error(data.error || 'Failed to update shift');
      }
    } catch (error) {
      toast.error('Failed to update shift');
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('Are you sure you want to archive this shift?')) return;

    try {
      const response = await fetch(`/api/shifts/${shiftId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Shift archived successfully');
        fetchShifts();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to archive shift');
      }
    } catch (error) {
      toast.error('Failed to archive shift');
    }
  };

  const handleCreateAssignment = async () => {
    try {
      const response = await fetch('/api/shifts/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignmentFormData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Shift assigned successfully');
        setAssignmentDialogOpen(false);
        resetAssignmentForm();
        fetchAssignments();
      } else {
        toast.error(data.error || 'Failed to assign shift');
      }
    } catch (error) {
      toast.error('Failed to assign shift');
    }
  };

  const handleCreateRoster = async () => {
    try {
      const response = await fetch('/api/shifts/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rosterFormData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Roster created for ${data.created} employees`);
        setRosterDialogOpen(false);
        resetRosterForm();
      } else {
        toast.error(data.error || 'Failed to create roster');
      }
    } catch (error) {
      toast.error('Failed to create roster');
    }
  };

  const resetShiftForm = () => {
    setShiftFormData({
      name: '',
      shiftType: 'fixed',
      startTime: '09:00',
      endTime: '18:00',
      gracePeriod: 15,
      earlyExitGracePeriod: 15,
      minimumWorkingHours: 480,
      breakDuration: 60,
      isBreakPaid: false,
      workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      isNightShift: false,
      description: '',
    });
  };

  const resetAssignmentForm = () => {
    setAssignmentFormData({
      shiftId: '',
      assignmentType: 'permanent',
      assignmentScope: 'employee',
      employeeId: '',
      teamManagerId: '',
      departmentRole: '',
      startDate: '',
      endDate: '',
      effectiveDate: new Date().toISOString().split('T')[0],
      reason: '',
    });
  };

  const resetRosterForm = () => {
    setRosterFormData({
      employeeIds: [],
      shiftId: '',
      startDate: '',
      endDate: '',
      isWeeklyOff: false,
      notes: '',
    });
  };

  const fetchBreakPolicies = async () => {
    try {
      const response = await fetch('/api/breaks/policies?isActive=true');
      if (response.ok) {
        const data = await response.json();
        setBreakPolicies(data);
      }
    } catch (error) {
      toast.error('Failed to fetch break policies');
    }
  };

  const fetchBreakAnalytics = async () => {
    try {
      const today = new Date();
      const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const response = await fetch(
        `/api/breaks/analytics?startDate=${startDate.toISOString().split('T')[0]}&endDate=${today.toISOString().split('T')[0]}`
      );
      if (response.ok) {
        const data = await response.json();
        setBreakAnalytics(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch break analytics:', error);
    }
  };

  const handleCreateBreakPolicy = async () => {
    try {
      const response = await fetch('/api/breaks/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(breakPolicyFormData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Break policy created successfully');
        setBreakPolicyDialogOpen(false);
        resetBreakPolicyForm();
        fetchBreakPolicies();
      } else {
        toast.error(data.error || 'Failed to create break policy');
      }
    } catch (error) {
      toast.error('Failed to create break policy');
    }
  };

  const handleUpdateBreakPolicy = async () => {
    if (!editingBreakPolicy) return;

    try {
      const response = await fetch(`/api/breaks/policies/${editingBreakPolicy._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(breakPolicyFormData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Break policy updated successfully');
        setBreakPolicyDialogOpen(false);
        setEditingBreakPolicy(null);
        resetBreakPolicyForm();
        fetchBreakPolicies();
      } else {
        toast.error(data.error || 'Failed to update break policy');
      }
    } catch (error) {
      toast.error('Failed to update break policy');
    }
  };

  const handleDeleteBreakPolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to deactivate this break policy?')) return;

    try {
      const response = await fetch(`/api/breaks/policies/${policyId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Break policy deactivated successfully');
        fetchBreakPolicies();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to deactivate break policy');
      }
    } catch (error) {
      toast.error('Failed to deactivate break policy');
    }
  };

  const resetBreakPolicyForm = () => {
    setBreakPolicyFormData({
      name: '',
      description: '',
      scope: 'global',
      scopeIds: [],
      allowBreaks: true,
      maxBreaksPerDay: 3,
      maxTotalBreakDuration: 60,
      maxDurationPerBreak: 30,
      allowedBreakTypes: ['lunch', 'tea', 'personal'],
      mandatoryBreaks: [],
      minWorkingHoursBeforeFirstBreak: 2,
      gracePeriod: 5,
      paidBreaks: ['lunch'],
      deductBreakTime: true,
      autoFlagExcessiveBreaks: true,
      allowBreakOverrun: false,
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
      isActive: true,
    });
  };

  const openEditBreakPolicy = (policy: BreakPolicy) => {
    setEditingBreakPolicy(policy);
    setBreakPolicyFormData({
      name: policy.name,
      description: policy.description || '',
      scope: policy.scope,
      scopeIds: policy.scopeIds.map((id: any) => id.toString()),
      allowBreaks: policy.allowBreaks,
      maxBreaksPerDay: policy.maxBreaksPerDay,
      maxTotalBreakDuration: policy.maxTotalBreakDuration,
      maxDurationPerBreak: policy.maxDurationPerBreak,
      allowedBreakTypes: policy.allowedBreakTypes,
      mandatoryBreaks: policy.mandatoryBreaks,
      minWorkingHoursBeforeFirstBreak: policy.minWorkingHoursBeforeFirstBreak,
      gracePeriod: policy.gracePeriod,
      paidBreaks: policy.paidBreaks,
      deductBreakTime: policy.deductBreakTime,
      autoFlagExcessiveBreaks: policy.autoFlagExcessiveBreaks,
      allowBreakOverrun: policy.allowBreakOverrun,
      effectiveFrom: new Date(policy.effectiveFrom).toISOString().split('T')[0],
      effectiveTo: policy.effectiveTo ? new Date(policy.effectiveTo).toISOString().split('T')[0] : '',
      isActive: policy.isActive,
    });
    setBreakPolicyDialogOpen(true);
  };

  const openEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setShiftFormData({
      name: shift.name,
      shiftType: shift.shiftType,
      startTime: shift.startTime,
      endTime: shift.endTime,
      gracePeriod: shift.gracePeriod,
      earlyExitGracePeriod: shift.earlyExitGracePeriod,
      minimumWorkingHours: shift.minimumWorkingHours,
      breakDuration: shift.breakDuration,
      isBreakPaid: shift.isBreakPaid,
      workingDays: shift.workingDays,
      isNightShift: shift.isNightShift,
      description: shift.description || '',
    });
    setShiftDialogOpen(true);
  };

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shift & Roster Management</h1>
          <p className="text-muted-foreground">Manage shifts, assignments, and rosters</p>
        </div>
      </div>

      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 gap-1 bg-transparent p-0 h-auto border-b-2 border-border">
            <TabsTrigger 
              value="shifts"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
            >
              Shifts
            </TabsTrigger>
            <TabsTrigger 
              value="assignments"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
            >
              Assignments
            </TabsTrigger>
            <TabsTrigger 
              value="roster"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
            >
              Roster
            </TabsTrigger>
            <TabsTrigger 
              value="break-policies"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
            >
              Break Policies
            </TabsTrigger>
          </TabsList>

          {/* Shifts Tab */}
          <TabsContent value="shifts" className="mt-4">
          <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => {
              resetShiftForm();
              setEditingShift(null);
              setShiftDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Shift
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {shifts.map((shift) => (
              <Card key={shift._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{shift.name}</CardTitle>
                      <CardDescription className="capitalize">{shift.shiftType} shift</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditShift(shift)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteShift(shift._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      <span>{shift.startTime} - {shift.endTime}</span>
                      {shift.isNightShift && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Night</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Grace Period: {shift.gracePeriod} min
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Min Hours: {shift.minimumWorkingHours / 60}h
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Break: {shift.breakDuration} min ({shift.isBreakPaid ? 'Paid' : 'Unpaid'})
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Days: {shift.workingDays.join(', ')}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          </div>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setAssignmentDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Shift
                </Button>
              </div>

              <div className="space-y-4">
                {assignments.map((assignment) => (
                  <Card key={assignment._id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{assignment.shiftId.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {assignment.assignmentScope === 'employee' && assignment.employeeId && (
                              <>Employee: {assignment.employeeId?.name || 'Employee Deleted'} ({assignment.employeeId?.employeeId || 'N/A'})</>
                            )}
                            {assignment.assignmentScope === 'team' && assignment.teamManagerId && (
                              <>Team: {assignment.teamManagerId.name}'s Team</>
                            )}
                            {assignment.assignmentScope === 'department' && (
                              <>Department: {assignment.departmentRole}</>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Type: {assignment.assignmentType}
                            {assignment.assignmentType === 'temporary' && assignment.startDate && assignment.endDate && (
                              <> • {formatDate(assignment.startDate)} - {formatDate(assignment.endDate)}</>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {assignment.isActive ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Roster Tab */}
          <TabsContent value="roster" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setRosterDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Roster
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Roster Management</CardTitle>
                  <CardDescription>
                    Create daily shift assignments for employees. Use this for rotational shifts or temporary overrides.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Select employees, dates, and shift to create roster entries. The system will automatically check for conflicts.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Break Policies Tab */}
          <TabsContent value="break-policies" className="mt-4">
            <BreakPoliciesTab shifts={shifts} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Shift Dialog */}
      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Edit Shift' : 'Create New Shift'}</DialogTitle>
            <DialogDescription>Define shift timing rules and configurations</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Shift Name *</Label>
              <Input
                id="name"
                value={shiftFormData.name}
                onChange={(e) => setShiftFormData({ ...shiftFormData, name: e.target.value })}
                placeholder="e.g., Morning Shift"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="shiftType">Shift Type *</Label>
                <Select
                  value={shiftFormData.shiftType}
                  onValueChange={(value: 'fixed' | 'rotational' | 'flexible') =>
                    setShiftFormData({ ...shiftFormData, shiftType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="rotational">Rotational</SelectItem>
                    <SelectItem value="flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="isNightShift">Night Shift</Label>
                <Select
                  value={shiftFormData.isNightShift ? 'yes' : 'no'}
                  onValueChange={(value) =>
                    setShiftFormData({ ...shiftFormData, isNightShift: value === 'yes' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={shiftFormData.startTime}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, startTime: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={shiftFormData.endTime}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, endTime: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="gracePeriod">Grace Period (min) *</Label>
                <Input
                  id="gracePeriod"
                  type="number"
                  value={shiftFormData.gracePeriod}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, gracePeriod: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="earlyExitGrace">Early Exit Grace (min) *</Label>
                <Input
                  id="earlyExitGrace"
                  type="number"
                  value={shiftFormData.earlyExitGracePeriod}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, earlyExitGracePeriod: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="minHours">Min Hours (hours) *</Label>
                <Input
                  id="minHours"
                  type="number"
                  value={shiftFormData.minimumWorkingHours / 60}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, minimumWorkingHours: (parseInt(e.target.value) || 0) * 60 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="breakDuration">Break Duration (min) *</Label>
                <Input
                  id="breakDuration"
                  type="number"
                  value={shiftFormData.breakDuration}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, breakDuration: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="isBreakPaid">Break Paid</Label>
                <Select
                  value={shiftFormData.isBreakPaid ? 'yes' : 'no'}
                  onValueChange={(value) =>
                    setShiftFormData({ ...shiftFormData, isBreakPaid: value === 'yes' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">Unpaid</SelectItem>
                    <SelectItem value="yes">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Working Days *</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                  <label key={day} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={shiftFormData.workingDays.includes(day)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setShiftFormData({
                            ...shiftFormData,
                            workingDays: [...shiftFormData.workingDays, day],
                          });
                        } else {
                          setShiftFormData({
                            ...shiftFormData,
                            workingDays: shiftFormData.workingDays.filter((d) => d !== day),
                          });
                        }
                      }}
                    />
                    <span className="text-sm capitalize">{day}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={shiftFormData.description}
                onChange={(e) => setShiftFormData({ ...shiftFormData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShiftDialogOpen(false);
              setEditingShift(null);
              resetShiftForm();
            }}>
              Cancel
            </Button>
            <Button onClick={editingShift ? handleUpdateShift : handleCreateShift}>
              {editingShift ? 'Update' : 'Create'} Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Shift Dialog */}
      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Shift</DialogTitle>
            <DialogDescription>Assign a shift to employee, team, or department</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="assignmentShift">Shift *</Label>
              <Select
                value={assignmentFormData.shiftId}
                onValueChange={(value) => setAssignmentFormData({ ...assignmentFormData, shiftId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((shift) => (
                    <SelectItem key={shift._id} value={shift._id}>
                      {shift.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="assignmentType">Assignment Type *</Label>
                <Select
                  value={assignmentFormData.assignmentType}
                  onValueChange={(value: 'permanent' | 'temporary') =>
                    setAssignmentFormData({ ...assignmentFormData, assignmentType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">Permanent</SelectItem>
                    <SelectItem value="temporary">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="assignmentScope">Assignment Scope *</Label>
                <Select
                  value={assignmentFormData.assignmentScope}
                  onValueChange={(value: 'employee' | 'team' | 'department') =>
                    setAssignmentFormData({ ...assignmentFormData, assignmentScope: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {assignmentFormData.assignmentScope === 'employee' && (
              <div>
                <Label htmlFor="employeeId">Employee *</Label>
                <Select
                  value={assignmentFormData.employeeId}
                  onValueChange={(value) => setAssignmentFormData({ ...assignmentFormData, employeeId: value })}
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
            )}

            {assignmentFormData.assignmentScope === 'team' && (
              <div>
                <Label htmlFor="teamManagerId">Team Manager *</Label>
                <Select
                  value={assignmentFormData.teamManagerId}
                  onValueChange={(value) => setAssignmentFormData({ ...assignmentFormData, teamManagerId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp._id} value={emp._id}>
                        {emp.name} ({emp.employeeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Select the manager whose team will get this shift
                </p>
              </div>
            )}

            {assignmentFormData.assignmentScope === 'department' && (
              <div>
                <Label htmlFor="departmentRole">Department Role *</Label>
                <Input
                  id="departmentRole"
                  value={assignmentFormData.departmentRole}
                  onChange={(e) => setAssignmentFormData({ ...assignmentFormData, departmentRole: e.target.value })}
                  placeholder="e.g., Software Engineer"
                />
              </div>
            )}

            {assignmentFormData.assignmentType === 'temporary' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={assignmentFormData.startDate}
                    onChange={(e) => setAssignmentFormData({ ...assignmentFormData, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={assignmentFormData.endDate}
                    onChange={(e) => setAssignmentFormData({ ...assignmentFormData, endDate: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="effectiveDate">Effective Date *</Label>
              <Input
                id="effectiveDate"
                type="date"
                value={assignmentFormData.effectiveDate}
                onChange={(e) => setAssignmentFormData({ ...assignmentFormData, effectiveDate: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={assignmentFormData.reason}
                onChange={(e) => setAssignmentFormData({ ...assignmentFormData, reason: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAssignmentDialogOpen(false);
              resetAssignmentForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateAssignment}>Assign Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Roster Dialog */}
      <Dialog open={rosterDialogOpen} onOpenChange={setRosterDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Roster</DialogTitle>
            <DialogDescription>Assign shifts to employees for specific dates</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="rosterShift">Shift *</Label>
              <Select
                value={rosterFormData.shiftId}
                onValueChange={(value) => setRosterFormData({ ...rosterFormData, shiftId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((shift) => (
                    <SelectItem key={shift._id} value={shift._id}>
                      {shift.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rosterStartDate">Start Date *</Label>
                <Input
                  id="rosterStartDate"
                  type="date"
                  value={rosterFormData.startDate}
                  onChange={(e) => setRosterFormData({ ...rosterFormData, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="rosterEndDate">End Date *</Label>
                <Input
                  id="rosterEndDate"
                  type="date"
                  value={rosterFormData.endDate}
                  onChange={(e) => setRosterFormData({ ...rosterFormData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Select Employees *</Label>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto mt-2">
                {employees.map((emp) => (
                  <label key={emp._id} className="flex items-center space-x-2 py-1">
                    <input
                      type="checkbox"
                      checked={rosterFormData.employeeIds.includes(emp._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRosterFormData({
                            ...rosterFormData,
                            employeeIds: [...rosterFormData.employeeIds, emp._id],
                          });
                        } else {
                          setRosterFormData({
                            ...rosterFormData,
                            employeeIds: rosterFormData.employeeIds.filter((id) => id !== emp._id),
                          });
                        }
                      }}
                    />
                    <span className="text-sm">{emp.name} ({emp.employeeId})</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="rosterNotes">Notes</Label>
              <Textarea
                id="rosterNotes"
                value={rosterFormData.notes}
                onChange={(e) => setRosterFormData({ ...rosterFormData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRosterDialogOpen(false);
              resetRosterForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateRoster}>Create Roster</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

