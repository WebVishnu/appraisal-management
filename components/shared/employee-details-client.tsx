'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mail,
  User,
  Calendar,
  Clock,
  Briefcase,
  ClipboardCheck,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Save,
  X,
  Phone,
  MapPin,
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  FileText,
  Plane,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { toast } from 'sonner';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

// Type definitions
interface Employee {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  managerId?: {
    _id: string;
    name: string;
    employeeId: string;
    email: string;
  };
  isActive: boolean;
  createdAt: string;
}

interface ShiftData {
  current: {
    shiftId: string;
    shift: {
      _id: string;
      name: string;
      shiftType: string;
      startTime: string;
      endTime: string;
      gracePeriod: number;
      workingDays: string[];
      isNightShift: boolean;
    };
  } | null;
  assignments: Array<{
    _id: string;
    shiftId: any;
    assignmentType: string;
    assignmentScope: string;
    effectiveDate: string;
    startDate?: string;
    endDate?: string;
  }>;
  upcomingRosters: Array<{
    _id: string;
    date: string;
    shiftId: any;
    isWeeklyOff: boolean;
  }>;
}

interface HealthIndicators {
  attendanceRisk: 'low' | 'medium' | 'high';
  productivityRisk: 'low' | 'medium' | 'high';
  burnoutRisk: 'low' | 'medium' | 'high';
  flags: string[];
}

interface EmployeeDetailsData {
  employee: Employee;
  shift: ShiftData;
  attendance: {
    recent: any[];
    stats: {
      thisMonth: number;
      totalDays: number;
      lateCount: number;
      averageHours: number;
    };
    calendar: any[];
  };
  workReports: {
    recent: any[];
    stats: {
      total: number;
      approved: number;
      pending: number;
      returned: number;
      averageProductivity: number;
    };
  };
  leaves: {
    recent: any[];
    balances: any[];
    stats: {
      pending: number;
      approved: number;
      rejected: number;
      totalDays: number;
    };
    calendar: any[];
  };
  healthIndicators: HealthIndicators | null;
  onboarding: any | null;
}

interface Shift {
  _id: string;
  name: string;
  shiftType: string;
  startTime: string;
  endTime: string;
}

export default function EmployeeDetailsClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [data, setData] = useState<EmployeeDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [managerDialogOpen, setManagerDialogOpen] = useState(false);
  const [availableManagers, setAvailableManagers] = useState<Employee[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  
  // Assignment modal state
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>([]);
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

  const canEdit = session?.user.role === 'hr' || session?.user.role === 'super_admin';

  useEffect(() => {
    if (params.id) {
      fetchEmployeeDetails(params.id as string);
    }
  }, [params.id]);

  // Check for assignShift search param and open modal
  useEffect(() => {
    const assignShift = searchParams.get('assignShift');
    if (assignShift === 'true' && params.id && canEdit) {
      setAssignmentDialogOpen(true);
      setAssignmentFormData(prev => ({
        ...prev,
        employeeId: params.id as string,
        assignmentScope: 'employee',
      }));
      // Remove the search param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('assignShift');
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [searchParams, params.id, canEdit, router]);

  // Fetch shifts for assignment modal
  useEffect(() => {
    if (assignmentDialogOpen && canEdit) {
      fetchShifts();
    }
  }, [assignmentDialogOpen, canEdit]);

  const fetchShifts = async () => {
    try {
      const response = await fetch('/api/shifts?isActive=true');
      if (response.ok) {
        const shiftsData = await response.json();
        setShifts(shiftsData);
      }
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  };

  const resetAssignmentForm = () => {
    setAssignmentFormData({
      shiftId: '',
      assignmentType: 'permanent',
      assignmentScope: 'employee',
      employeeId: (params.id as string) || (employee?._id) || '',
      teamManagerId: '',
      departmentRole: '',
      startDate: '',
      endDate: '',
      effectiveDate: new Date().toISOString().split('T')[0],
      reason: '',
    });
  };

  const handleCreateAssignment = async () => {
    try {
      const response = await fetch('/api/shifts/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignmentFormData),
      });

      const responseData = await response.json();

      if (response.ok) {
        toast.success('Shift assigned successfully');
        setAssignmentDialogOpen(false);
        resetAssignmentForm();
        // Refresh employee details to show updated shift
        if (params.id) {
          fetchEmployeeDetails(params.id as string);
        }
      } else {
        toast.error(responseData.error || 'Failed to assign shift');
      }
    } catch (error) {
      console.error('Error assigning shift:', error);
      toast.error('Failed to assign shift');
    }
  };

  const fetchEmployeeDetails = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/employees/${id}`);
      if (response.ok) {
        const detailsData = await response.json();
        setData(detailsData);
        setEditFormData({
          employeeId: detailsData.employee.employeeId,
          name: detailsData.employee.name,
          email: detailsData.employee.email,
          role: detailsData.employee.role,
          managerId: detailsData.employee.managerId?._id || '',
          isActive: detailsData.employee.isActive,
        });
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to fetch employee details');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching employee details:', error);
      toast.error('Failed to fetch employee details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`/api/employees/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      if (response.ok) {
        toast.success('Employee updated successfully');
        setEditDialogOpen(false);
        fetchEmployeeDetails(params.id as string);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update employee');
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error('Failed to update employee');
    }
  };

  const fetchAvailableManagers = async (currentEmployeeId: string) => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const employees = await response.json();
        // Filter for managers (role contains manager) and exclude current employee
        const managers = employees.filter((emp: Employee) => 
          emp._id !== currentEmployeeId && 
          (emp.role.toLowerCase().includes('manager') || 
           emp.role.toLowerCase().includes('mgr'))
        );
        setAvailableManagers(managers);
      }
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const handleAssignManager = async () => {
    try {
      const response = await fetch(`/api/employees/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId: selectedManagerId === 'none' || !selectedManagerId ? null : selectedManagerId,
        }),
      });

      if (response.ok) {
        toast.success('Manager assigned successfully');
        setManagerDialogOpen(false);
        fetchEmployeeDetails(params.id as string);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to assign manager');
      }
    } catch (error) {
      console.error('Error assigning manager:', error);
      toast.error('Failed to assign manager');
    }
  };

  const handleOpenManagerDialog = () => {
    if (data?.employee) {
      setSelectedManagerId(data.employee.managerId?._id || 'none');
      fetchAvailableManagers(data.employee._id);
      setManagerDialogOpen(true);
    }
  };

  const canViewHealthIndicators = session?.user.role === 'manager' || session?.user.role === 'hr' || session?.user.role === 'super_admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading employee details...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-lg font-semibold">Employee not found</p>
        </div>
      </div>
    );
  }

  const { employee, shift, attendance, workReports, leaves, healthIndicators, onboarding } = data;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{employee.name}</h1>
          <p className="text-muted-foreground">{employee.employeeId}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={employee.isActive ? 'default' : 'secondary'}>
            {employee.isActive ? 'Active' : 'Inactive'}
          </Badge>
          {canEdit && (
            <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      {/* System Flags & Health Indicators (Section 7) - Visible to Manager/HR only */}
      {canViewHealthIndicators && healthIndicators && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              System Health Indicators
            </CardTitle>
            <CardDescription>Automated risk assessment and flags</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  healthIndicators.attendanceRisk === 'high' ? 'bg-red-100 dark:bg-red-900/20' :
                  healthIndicators.attendanceRisk === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                  'bg-green-100 dark:bg-green-900/20'
                }`}>
                  <UserCheck className={`h-5 w-5 ${
                    healthIndicators.attendanceRisk === 'high' ? 'text-red-600' :
                    healthIndicators.attendanceRisk === 'medium' ? 'text-yellow-600' :
                    'text-green-600'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Attendance Risk</p>
                  <p className="font-semibold capitalize">{healthIndicators.attendanceRisk}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  healthIndicators.productivityRisk === 'high' ? 'bg-red-100 dark:bg-red-900/20' :
                  healthIndicators.productivityRisk === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                  'bg-green-100 dark:bg-green-900/20'
                }`}>
                  <TrendingUp className={`h-5 w-5 ${
                    healthIndicators.productivityRisk === 'high' ? 'text-red-600' :
                    healthIndicators.productivityRisk === 'medium' ? 'text-yellow-600' :
                    'text-green-600'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Productivity Risk</p>
                  <p className="font-semibold capitalize">{healthIndicators.productivityRisk}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  healthIndicators.burnoutRisk === 'high' ? 'bg-red-100 dark:bg-red-900/20' :
                  healthIndicators.burnoutRisk === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                  'bg-green-100 dark:bg-green-900/20'
                }`}>
                  <Activity className={`h-5 w-5 ${
                    healthIndicators.burnoutRisk === 'high' ? 'text-red-600' :
                    healthIndicators.burnoutRisk === 'medium' ? 'text-yellow-600' :
                    'text-green-600'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Burnout Risk</p>
                  <p className="font-semibold capitalize">{healthIndicators.burnoutRisk}</p>
                </div>
              </div>
            </div>
            {healthIndicators.flags.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Flags:</p>
                <div className="flex flex-wrap gap-2">
                  {healthIndicators.flags.map((flag, idx) => (
                    <Badge key={idx} variant="outline" className="text-orange-600 border-orange-300">
                      {flag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 gap-1 bg-transparent p-0 h-auto border-b-2 border-border">
          <TabsTrigger 
            value="profile"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
          >
            Profile
          </TabsTrigger>
          <TabsTrigger 
            value="shift"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
          >
            Shift & Schedule
          </TabsTrigger>
          <TabsTrigger 
            value="attendance"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
          >
            Attendance
          </TabsTrigger>
          <TabsTrigger 
            value="productivity"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
          >
            Productivity
          </TabsTrigger>
          <TabsTrigger 
            value="leaves"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
          >
            Leaves
          </TabsTrigger>
        </TabsList>

        {/* Section 1: Basic Profile */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Employee ID</Label>
                  <p className="font-medium">{employee.employeeId}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Full Name</Label>
                  <p className="font-medium">{employee.name}</p>
                  {onboarding?.personalDetails?.fullName && onboarding.personalDetails.fullName !== employee.name && (
                    <p className="text-sm text-muted-foreground">(as per onboarding: {onboarding.personalDetails.fullName})</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <p className="font-medium">{employee.email}</p>
                  {onboarding?.personalDetails?.personalEmail && onboarding.personalDetails.personalEmail !== employee.email && (
                    <p className="text-sm text-muted-foreground">Personal: {onboarding.personalDetails.personalEmail}</p>
                  )}
                </div>
                {onboarding?.personalDetails?.dateOfBirth && (
                  <div>
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">{formatDate(onboarding.personalDetails.dateOfBirth)}</p>
                  </div>
                )}
                {onboarding?.personalDetails?.gender && (
                  <div>
                    <Label className="text-muted-foreground">Gender</Label>
                    <p className="font-medium capitalize">{onboarding.personalDetails.gender}</p>
                  </div>
                )}
                {onboarding?.personalDetails?.maritalStatus && (
                  <div>
                    <Label className="text-muted-foreground">Marital Status</Label>
                    <p className="font-medium capitalize">{onboarding.personalDetails.maritalStatus}</p>
                  </div>
                )}
                {onboarding?.personalDetails?.nationality && (
                  <div>
                    <Label className="text-muted-foreground">Nationality</Label>
                    <p className="font-medium">{onboarding.personalDetails.nationality}</p>
                  </div>
                )}
                {onboarding?.personalDetails?.mobileNumber && (
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Mobile Number
                    </Label>
                    <p className="font-medium">{onboarding.personalDetails.mobileNumber}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date of Joining
                  </Label>
                  <p className="font-medium">
                    {onboarding?.employmentDetails?.dateOfJoining 
                      ? formatDate(onboarding.employmentDetails.dateOfJoining)
                      : formatDate(employee.createdAt)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Employment Status</Label>
                  <Badge variant={employee.isActive ? 'default' : 'secondary'}>
                    {employee.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Role & Organizational Mapping */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Organizational Structure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Role</Label>
                  <p className="font-medium capitalize">{employee.role}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Designation</Label>
                  <p className="font-medium">{onboarding?.employmentDetails?.designation || employee.role}</p>
                </div>
                {onboarding?.employmentDetails?.employmentType && (
                  <div>
                    <Label className="text-muted-foreground">Employment Type</Label>
                    <p className="font-medium capitalize">{onboarding.employmentDetails.employmentType.replace('_', ' ')}</p>
                  </div>
                )}
                {onboarding?.employmentDetails?.workLocation && (
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Work Location
                    </Label>
                    <p className="font-medium">{onboarding.employmentDetails.workLocation}</p>
                  </div>
                )}
                {onboarding?.employmentDetails?.probationStatus !== undefined && (
                  <div>
                    <Label className="text-muted-foreground">Probation Status</Label>
                    <Badge variant={onboarding.employmentDetails.probationStatus ? 'secondary' : 'default'}>
                      {onboarding.employmentDetails.probationStatus ? 'On Probation' : 'Confirmed'}
                    </Badge>
                    {onboarding.employmentDetails.probationPeriodMonths && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Period: {onboarding.employmentDetails.probationPeriodMonths} months
                      </p>
                    )}
                  </div>
                )}
                {employee.managerId && (
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Reporting Manager
                    </Label>
                    <Link 
                      href={`/dashboard/${session?.user.role}/employees/${employee.managerId._id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {employee.managerId.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{employee.managerId.email}</p>
                  </div>
                )}
                {!employee.managerId && (
                  <div>
                    <Label className="text-muted-foreground">Reporting Manager</Label>
                    <p className="text-muted-foreground italic">No manager assigned</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Additional Onboarding Details */}
          {onboarding ? (
            <>
              {/* Address Details */}
              {onboarding.addressDetails && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Address Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground font-semibold">Current Address</Label>
                      <div className="mt-2 p-3 border rounded-lg">
                        <p className="font-medium">{onboarding.addressDetails.currentAddress.line1}</p>
                        {onboarding.addressDetails.currentAddress.line2 && (
                          <p>{onboarding.addressDetails.currentAddress.line2}</p>
                        )}
                        <p>
                          {onboarding.addressDetails.currentAddress.city}, {onboarding.addressDetails.currentAddress.state}
                        </p>
                        <p>
                          {onboarding.addressDetails.currentAddress.pincode}, {onboarding.addressDetails.currentAddress.country}
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground font-semibold">Permanent Address</Label>
                      <div className="mt-2 p-3 border rounded-lg">
                        <p className="font-medium">{onboarding.addressDetails.permanentAddress.line1}</p>
                        {onboarding.addressDetails.permanentAddress.line2 && (
                          <p>{onboarding.addressDetails.permanentAddress.line2}</p>
                        )}
                        <p>
                          {onboarding.addressDetails.permanentAddress.city}, {onboarding.addressDetails.permanentAddress.state}
                        </p>
                        <p>
                          {onboarding.addressDetails.permanentAddress.pincode}, {onboarding.addressDetails.permanentAddress.country}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Identity & KYC */}
              {onboarding.identityKYC && (
                <Card>
                  <CardHeader>
                    <CardTitle>Identity & KYC Documents</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {onboarding.identityKYC.aadhaarNumber && (
                        <div>
                          <Label className="text-muted-foreground">Aadhaar Number</Label>
                          <p className="font-medium">{onboarding.identityKYC.aadhaarNumber}</p>
                          {onboarding.identityKYC.aadhaarDocumentUrl && (
                            <a
                              href={onboarding.identityKYC.aadhaarDocumentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm flex items-center gap-1 mt-1"
                            >
                              <FileText className="h-4 w-4" />
                              View Document
                            </a>
                          )}
                        </div>
                      )}
                      {onboarding.identityKYC.panNumber && (
                        <div>
                          <Label className="text-muted-foreground">PAN Number</Label>
                          <p className="font-medium">{onboarding.identityKYC.panNumber}</p>
                          {onboarding.identityKYC.panDocumentUrl && (
                            <a
                              href={onboarding.identityKYC.panDocumentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm flex items-center gap-1 mt-1"
                            >
                              <FileText className="h-4 w-4" />
                              View Document
                            </a>
                          )}
                        </div>
                      )}
                      {onboarding.identityKYC.passportNumber && (
                        <div>
                          <Label className="text-muted-foreground">Passport Number</Label>
                          <p className="font-medium">{onboarding.identityKYC.passportNumber}</p>
                          {onboarding.identityKYC.passportDocumentUrl && (
                            <a
                              href={onboarding.identityKYC.passportDocumentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm flex items-center gap-1 mt-1"
                            >
                              <FileText className="h-4 w-4" />
                              View Document
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    {onboarding.personalDetails?.photographUrl && (
                      <div>
                        <Label className="text-muted-foreground font-semibold">Photograph</Label>
                        <div className="mt-2">
                          <img
                            src={onboarding.personalDetails.photographUrl}
                            alt="Employee Photograph"
                            className="max-w-xs h-auto rounded-lg border"
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Compensation & Payroll */}
              {onboarding.compensationPayroll && (
                <Card>
                  <CardHeader>
                    <CardTitle>Compensation & Payroll</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Annual CTC</Label>
                        <p className="font-medium">₹{onboarding.compensationPayroll.annualCTC?.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Basic Salary</Label>
                        <p className="font-medium">₹{onboarding.compensationPayroll.basicSalary?.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">HRA</Label>
                        <p className="font-medium">₹{onboarding.compensationPayroll.hra?.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Allowances</Label>
                        <p className="font-medium">₹{onboarding.compensationPayroll.allowances?.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Pay Frequency</Label>
                        <p className="font-medium capitalize">{onboarding.compensationPayroll.payFrequency?.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">PF Applicable</Label>
                        <Badge variant={onboarding.compensationPayroll.pfApplicable ? 'default' : 'secondary'}>
                          {onboarding.compensationPayroll.pfApplicable ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">ESI Applicable</Label>
                        <Badge variant={onboarding.compensationPayroll.esiApplicable ? 'default' : 'secondary'}>
                          {onboarding.compensationPayroll.esiApplicable ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground font-semibold">Bank Details</Label>
                      <div className="mt-2 p-3 border rounded-lg grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Bank Name</p>
                          <p className="font-medium">{onboarding.compensationPayroll.bankName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Account Number</p>
                          <p className="font-medium">{onboarding.compensationPayroll.accountNumber}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">IFSC Code</p>
                          <p className="font-medium">{onboarding.compensationPayroll.ifscCode}</p>
                        </div>
                      </div>
                      {onboarding.compensationPayroll.bankProofUrl && (
                        <div className="mt-3">
                          <a
                            href={onboarding.compensationPayroll.bankProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm flex items-center gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            View Bank Proof
                          </a>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Statutory & Tax */}
              {onboarding.statutoryTax && (
                <Card>
                  <CardHeader>
                    <CardTitle>Statutory & Tax</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {onboarding.statutoryTax.pfUAN && (
                      <div>
                        <Label className="text-muted-foreground">PF UAN</Label>
                        <p className="font-medium">{onboarding.statutoryTax.pfUAN}</p>
                      </div>
                    )}
                    {onboarding.statutoryTax.esicNumber && (
                      <div>
                        <Label className="text-muted-foreground">ESIC Number</Label>
                        <p className="font-medium">{onboarding.statutoryTax.esicNumber}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-muted-foreground">Professional Tax</Label>
                      <Badge variant={onboarding.statutoryTax.professionalTaxApplicable ? 'default' : 'secondary'}>
                        {onboarding.statutoryTax.professionalTaxApplicable ? 'Applicable' : 'Not Applicable'}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Tax Regime</Label>
                      <p className="font-medium capitalize">{onboarding.statutoryTax.incomeTaxRegime}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Education Details */}
              {onboarding.educationDetails && onboarding.educationDetails.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Education Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {onboarding.educationDetails.map((edu: any, index: number) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <Label className="text-muted-foreground">Qualification</Label>
                            <p className="font-medium">{edu.qualification}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Degree</Label>
                            <p className="font-medium">{edu.degree}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Institution</Label>
                            <p className="font-medium">{edu.institution}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Year of Passing</Label>
                            <p className="font-medium">{edu.yearOfPassing}</p>
                          </div>
                        </div>
                        {edu.degreeCertificateUrl && (
                          <div className="mt-3">
                            <a
                              href={edu.degreeCertificateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm flex items-center gap-2"
                            >
                              <FileText className="h-4 w-4" />
                              View Degree Certificate
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Previous Employment */}
              {onboarding.previousEmployment && onboarding.previousEmployment.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Previous Employment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {onboarding.previousEmployment.map((prev: any, index: number) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground">Company</Label>
                            <p className="font-medium">{prev.companyName}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Designation</Label>
                            <p className="font-medium">{prev.designation}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Period</Label>
                            <p className="font-medium">
                              {formatDate(prev.startDate)} - {formatDate(prev.endDate)}
                            </p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Reason for Leaving</Label>
                            <p className="font-medium">{prev.reasonForLeaving}</p>
                          </div>
                        </div>
                        {(prev.experienceLetterUrl || prev.relievingLetterUrl) && (
                          <div className="mt-3 flex gap-4">
                            {prev.experienceLetterUrl && (
                              <a
                                href={prev.experienceLetterUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm flex items-center gap-2"
                              >
                                <FileText className="h-4 w-4" />
                                View Experience Letter
                              </a>
                            )}
                            {prev.relievingLetterUrl && (
                              <a
                                href={prev.relievingLetterUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm flex items-center gap-2"
                              >
                                <FileText className="h-4 w-4" />
                                View Relieving Letter
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Emergency Contact */}
              {onboarding.emergencyContact && (
                <Card>
                  <CardHeader>
                    <CardTitle>Emergency Contact</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="font-medium">{onboarding.emergencyContact.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Relationship</Label>
                      <p className="font-medium">{onboarding.emergencyContact.relationship}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Mobile</Label>
                      <p className="font-medium">{onboarding.emergencyContact.mobileNumber}</p>
                    </div>
                    {onboarding.emergencyContact.email && (
                      <div>
                        <Label className="text-muted-foreground">Email</Label>
                        <p className="font-medium">{onboarding.emergencyContact.email}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Policies & Declarations */}
              {onboarding.policiesDeclarations && (
                <Card>
                  <CardHeader>
                    <CardTitle>Policies & Declarations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Offer Letter</Label>
                        <Badge variant={onboarding.policiesDeclarations.offerLetterAccepted ? 'default' : 'secondary'}>
                          {onboarding.policiesDeclarations.offerLetterAccepted ? 'Accepted' : 'Pending'}
                        </Badge>
                        {onboarding.policiesDeclarations.offerLetterAcceptedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(onboarding.policiesDeclarations.offerLetterAcceptedAt)}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-muted-foreground">NDA</Label>
                        <Badge variant={onboarding.policiesDeclarations.ndaSigned ? 'default' : 'secondary'}>
                          {onboarding.policiesDeclarations.ndaSigned ? 'Signed' : 'Pending'}
                        </Badge>
                        {onboarding.policiesDeclarations.ndaSignedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(onboarding.policiesDeclarations.ndaSignedAt)}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Code of Conduct</Label>
                        <Badge variant={onboarding.policiesDeclarations.codeOfConductAccepted ? 'default' : 'secondary'}>
                          {onboarding.policiesDeclarations.codeOfConductAccepted ? 'Accepted' : 'Pending'}
                        </Badge>
                        {onboarding.policiesDeclarations.codeOfConductAcceptedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(onboarding.policiesDeclarations.codeOfConductAcceptedAt)}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-muted-foreground">POSH Policy</Label>
                        <Badge variant={onboarding.policiesDeclarations.poshPolicyAcknowledged ? 'default' : 'secondary'}>
                          {onboarding.policiesDeclarations.poshPolicyAcknowledged ? 'Acknowledged' : 'Pending'}
                        </Badge>
                        {onboarding.policiesDeclarations.poshPolicyAcknowledgedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(onboarding.policiesDeclarations.poshPolicyAcknowledgedAt)}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Data Privacy</Label>
                        <Badge variant={onboarding.policiesDeclarations.dataPrivacyConsent ? 'default' : 'secondary'}>
                          {onboarding.policiesDeclarations.dataPrivacyConsent ? 'Consented' : 'Pending'}
                        </Badge>
                        {onboarding.policiesDeclarations.dataPrivacyConsentAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(onboarding.policiesDeclarations.dataPrivacyConsentAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    {onboarding.policiesDeclarations.signedDocumentsUrl && (
                      <div>
                        <a
                          href={onboarding.policiesDeclarations.signedDocumentsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm flex items-center gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          View Signed Documents
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-6">
                <p className="text-center text-muted-foreground">
                  No onboarding details available for this employee.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Section 8: Role-Based Action Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Available actions based on your role</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {session?.user.role === 'employee' && (
                  <>
                    <Button asChild variant="outline">
                      <Link href="/dashboard/employee/leaves">
                        <Plane className="h-4 w-4 mr-2" />
                        Apply for Leave
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/dashboard/employee/work-reports">
                        <FileText className="h-4 w-4 mr-2" />
                        Submit Work Report
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/dashboard/employee/attendance">
                        <UserCheck className="h-4 w-4 mr-2" />
                        View Attendance
                      </Link>
                    </Button>
                  </>
                )}
                {session?.user.role === 'manager' && (
                  <>
                    <Button asChild variant="outline">
                      <Link href={`/dashboard/manager/work-reports?employeeId=${employee._id}`}>
                        <ClipboardCheck className="h-4 w-4 mr-2" />
                        Review Work Reports
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/dashboard/manager/leaves?employeeId=${employee._id}`}>
                        <Plane className="h-4 w-4 mr-2" />
                        Review Leaves
                      </Link>
                    </Button>
                  </>
                )}
                    {canEdit && (
                      <>
                        <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Profile
                        </Button>
                        <Button variant="outline" onClick={handleOpenManagerDialog}>
                          <Users className="h-4 w-4 mr-2" />
                          Assign Manager
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setAssignmentDialogOpen(true);
                          setAssignmentFormData(prev => ({
                            ...prev,
                            employeeId: employee._id,
                            assignmentScope: 'employee',
                          }));
                        }}>
                          <Clock className="h-4 w-4 mr-2" />
                          Assign Shift
                        </Button>
                      </>
                    )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Section 3: Shift & Work Schedule */}
        <TabsContent value="shift" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Current Shift Assignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {shift.current ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Shift Name</Label>
                      <p className="font-medium">{shift.current.shift.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Type</Label>
                      <p className="font-medium capitalize">{shift.current.shift.shiftType}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Timing</Label>
                      <p className="font-medium">
                        {shift.current.shift.startTime} - {shift.current.shift.endTime}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Grace Period</Label>
                      <p className="font-medium">{shift.current.shift.gracePeriod} min</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Working Days</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {shift.current.shift.workingDays.map((day: string) => (
                        <Badge key={day} variant="outline" className="capitalize">
                          {day}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {shift.current.shift.isNightShift && (
                    <Badge variant="secondary">Night Shift</Badge>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No shift assigned</p>
              )}
            </CardContent>
          </Card>

          {shift.upcomingRosters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Roster (Next 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {shift.upcomingRosters.slice(0, 10).map((roster) => (
                    <div key={roster._id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{formatDate(roster.date)}</p>
                        {roster.isWeeklyOff ? (
                          <Badge variant="secondary">Weekly Off</Badge>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {roster.shiftId?.name || 'No shift'}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Section 4: Attendance Summary */}
        <TabsContent value="attendance" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Present Days</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{attendance.stats.thisMonth}</p>
                <p className="text-xs text-muted-foreground">out of {attendance.stats.totalDays} days</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Late Arrivals</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{attendance.stats.lateCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Hours/Day</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{attendance.stats.averageHours}h</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Attendance Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {attendance.stats.totalDays > 0
                    ? Math.round((attendance.stats.thisMonth / attendance.stats.totalDays) * 100)
                    : 0}%
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Attendance Records</CardTitle>
            </CardHeader>
            <CardContent>
              {attendance.recent.length === 0 ? (
                <p className="text-muted-foreground">No attendance records found</p>
              ) : (
                <div className="space-y-2">
                  {attendance.recent.slice(0, 10).map((record: any) => (
                    <div key={record._id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{formatDate(record.date)}</p>
                        <p className="text-sm text-muted-foreground">
                          {record.checkIn && `Check-in: ${new Date(record.checkIn).toLocaleTimeString()}`}
                          {record.checkOut && ` • Check-out: ${new Date(record.checkOut).toLocaleTimeString()}`}
                        </p>
                      </div>
                      <Badge variant={record.status === 'present' ? 'default' : 'secondary'}>
                        {record.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Section 5: Work Reports & Productivity */}
        <TabsContent value="productivity" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{workReports.stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{workReports.stats.approved}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{workReports.stats.pending}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Productivity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{workReports.stats.averageProductivity}/100</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Work Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {workReports.recent.length === 0 ? (
                <p className="text-muted-foreground">No work reports found</p>
              ) : (
                <div className="space-y-2">
                  {workReports.recent.map((report: any) => (
                    <div key={report._id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{formatDate(report.reportDate)}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.totalWorkHours?.toFixed(1) || 0}h worked
                          {report.productivityScore && ` • ${report.productivityScore}/100 productivity`}
                        </p>
                      </div>
                      <Badge variant={report.status === 'approved' ? 'default' : 'secondary'}>
                        {report.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Section 6: Leave Details */}
        <TabsContent value="leaves" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{leaves.stats.pending}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{leaves.stats.approved}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{leaves.stats.rejected}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Days</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{leaves.stats.totalDays}</p>
              </CardContent>
            </Card>
          </div>

          {leaves.balances.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Leave Balances ({new Date().getFullYear()})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {leaves.balances.map((balance: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-3">
                      <p className="text-sm text-muted-foreground capitalize">{balance.leaveType}</p>
                      <p className="text-lg font-bold">{balance.availableDays} / {balance.totalDays}</p>
                      <p className="text-xs text-muted-foreground">Available / Total</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent Leave Applications</CardTitle>
            </CardHeader>
            <CardContent>
              {leaves.recent.length === 0 ? (
                <p className="text-muted-foreground">No leave applications found</p>
              ) : (
                <div className="space-y-2">
                  {leaves.recent.map((leave: any) => (
                    <div key={leave._id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{leave.leaveType}</span>
                          <Badge variant={leave.status === 'approved' ? 'default' : 'secondary'}>
                            {leave.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(leave.startDate)} - {formatDate(leave.endDate)} ({leave.numberOfDays} days)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Shift Dialog */}
      {canEdit && (
        <Dialog open={assignmentDialogOpen} onOpenChange={(open) => {
          setAssignmentDialogOpen(open);
          if (!open) {
            resetAssignmentForm();
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Assign Shift</DialogTitle>
              <DialogDescription>Assign a shift to {employee?.name || 'employee'}</DialogDescription>
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
                        {shift.name} ({shift.startTime} - {shift.endTime})
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
                  <Input
                    id="employeeId"
                    value={employee?.name || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Assigning shift to {employee?.name}
                  </p>
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
                      {employee?.managerId && (
                        <SelectItem value={employee.managerId._id}>
                          {employee.managerId.name}
                        </SelectItem>
                      )}
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
                    value={assignmentFormData.departmentRole || employee?.role || ''}
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
                  placeholder="Optional reason for this assignment"
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
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee Profile</DialogTitle>
            <DialogDescription>Update employee information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee ID</Label>
              <Input
                value={editFormData.employeeId || ''}
                onChange={(e) => setEditFormData({ ...editFormData, employeeId: e.target.value })}
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={editFormData.name || ''}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={editFormData.email || ''}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Input
                value={editFormData.role || ''}
                onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={editFormData.isActive ?? true}
                onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active Employee
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager Assignment Dialog */}
      <Dialog open={managerDialogOpen} onOpenChange={setManagerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Manager</DialogTitle>
            <DialogDescription>
              Select a manager for {employee.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Manager</Label>
              <p className="text-sm text-muted-foreground">
                {employee.managerId ? `${employee.managerId.name} (${employee.managerId.employeeId})` : 'No manager assigned'}
              </p>
            </div>
            <div>
              <Label>Select Manager</Label>
              <Select
                value={selectedManagerId}
                onValueChange={setSelectedManagerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Remove Manager)</SelectItem>
                  {availableManagers.map((manager) => (
                    <SelectItem key={manager._id} value={manager._id}>
                      {manager.name} ({manager.employeeId}) - {manager.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManagerDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignManager}>
              <Save className="h-4 w-4 mr-2" />
              Assign Manager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

