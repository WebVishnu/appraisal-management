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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  DollarSign,
  Users,
  FileText,
  Lock,
  Unlock,
  Download,
  AlertTriangle,
  Calendar,
  Plus,
  Edit,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { formatDate, formatErrorMessage } from '@/lib/utils/format';
import { SkeletonCard } from '@/components/shared/skeleton-loader';

interface SalaryStructure {
  _id: string;
  employeeId?: {
    _id: string;
    name: string;
    employeeId: string;
    email: string;
    role: string;
  };
  role?: string;
  grossMonthlySalary: number;
  workingDaysRule: string;
  fixedWorkingDays?: number;
  paidLeaveTypes: string[];
  unpaidLeaveTypes: string[];
  halfDayDeductionRule: string;
  effectiveFrom: string;
  effectiveTo?: string;
  version: number;
  isActive: boolean;
}

interface Payroll {
  _id: string;
  employeeId: {
    _id: string;
    name: string;
    employeeId: string;
    email: string;
  } | null;
  payrollMonth: number;
  payrollYear: number;
  grossMonthlySalary: number;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  payableDays: number;
  perDaySalary: number;
  grossPayable: number;
  deductions: {
    unpaidLeave: number;
    halfDay: number;
    latePenalty: number;
    total: number;
  };
  netPayable: number;
  status: 'draft' | 'processed' | 'locked';
  processedAt?: string;
  anomalies: string[];
  payslipGenerated: boolean;
}

interface DashboardStats {
  summary: {
    totalEmployees: number;
    employeesWithStructure: number;
    processedCount: number;
    lockedCount: number;
    draftCount: number;
    pendingCount: number;
    totalPayrollCost: number;
    payrollsWithAnomalies: number;
  };
  pendingEmployees: Array<{
    _id: string;
    name: string;
    employeeId: string;
    email: string;
  }>;
  currentMonth: number;
  currentYear: number;
}

export default function PayrollManagementClient() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Salary structures state
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState<SalaryStructure | null>(null);
  const [structureFormData, setStructureFormData] = useState({
    assignmentType: '' as 'employee' | 'role' | '',
    employeeId: '',
    role: '',
    grossMonthlySalary: 0,
    workingDaysRule: 'shift_based' as 'shift_based' | 'calendar_days' | 'fixed_days',
    fixedWorkingDays: 0,
    paidLeaveTypes: ['paid'] as string[],
    unpaidLeaveTypes: ['unpaid'] as string[],
    halfDayDeductionRule: 'half_day' as 'half_day' | 'proportional',
    effectiveFrom: new Date().toISOString().split('T')[0],
  });
  
  // Payrolls state
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [processingPayroll, setProcessingPayroll] = useState(false);
  const [employees, setEmployees] = useState<Array<{ _id: string; name: string; employeeId: string; role: string }>>([]);

  useEffect(() => {
    fetchDashboardStats();
    fetchSalaryStructures();
    fetchPayrolls();
    fetchEmployees();
  }, [selectedMonth, selectedYear]);

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch(`/api/payroll/dashboard?month=${selectedMonth}&year=${selectedYear}`);
      if (response.ok) {
        const data = await response.json();
        setDashboardStats(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalaryStructures = async () => {
    try {
      const response = await fetch('/api/payroll/salary-structure?isActive=true');
      if (response.ok) {
        const data = await response.json();
        setSalaryStructures(data);
      }
    } catch (error) {
      console.error('Error fetching salary structures:', error);
    }
  };

  const fetchPayrolls = async () => {
    try {
      const response = await fetch(`/api/payroll/process?month=${selectedMonth}&year=${selectedYear}`);
      if (response.ok) {
        const data = await response.json();
        setPayrolls(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching payrolls:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.filter((e: any) => e.isActive));
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleProcessPayroll = async () => {
    try {
      setProcessingPayroll(true);
      const response = await fetch('/api/payroll/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Payroll processed for ${data.processed} employees`);
        if (data.errors && data.errors.length > 0) {
          toast.warning(`${data.errors.length} employees had errors`);
        }
        fetchPayrolls();
        fetchDashboardStats();
      } else {
        const errorMessage = formatErrorMessage(data.error, 'Failed to process payroll');
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error processing payroll:', error);
      const errorMessage = formatErrorMessage(error, 'Failed to process payroll');
      toast.error(errorMessage);
    } finally {
      setProcessingPayroll(false);
    }
  };

  const handleLockPayroll = async (payrollId: string) => {
    try {
      const response = await fetch(`/api/payroll/${payrollId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock' }),
      });

      if (response.ok) {
        toast.success('Payroll locked successfully');
        fetchPayrolls();
        fetchDashboardStats();
      } else {
        const error = await response.json();
        const errorMessage = formatErrorMessage(error.error, 'Failed to lock payroll');
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error locking payroll:', error);
      const errorMessage = formatErrorMessage(error, 'Failed to lock payroll');
      toast.error(errorMessage);
    }
  };

  const handleGeneratePayslip = async (payrollId: string) => {
    try {
      const response = await fetch(`/api/payroll/payslip/${payrollId}`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Payslip generated successfully');
        fetchPayrolls();
      } else {
        const error = await response.json();
        const errorMessage = formatErrorMessage(error.error, 'Failed to generate payslip');
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error generating payslip:', error);
      const errorMessage = formatErrorMessage(error, 'Failed to generate payslip');
      toast.error(errorMessage);
    }
  };

  const handleDownloadPayslip = async (payrollId: string) => {
    try {
      const response = await fetch(`/api/payroll/payslip/${payrollId}`);
      if (response.ok) {
        const payslip = await response.json();
        if (payslip.pdfUrl) {
          // Open PDF in new window
          const link = document.createElement('a');
          link.href = payslip.pdfUrl;
          link.download = `payslip-${payslip.employeeId}-${payslip.payrollMonth}-${payslip.payrollYear}.pdf`;
          link.click();
        }
      }
    } catch (error) {
      console.error('Error downloading payslip:', error);
      toast.error('Failed to download payslip');
    }
  };

  const handleCreateSalaryStructure = async () => {
    try {
      // Validation
      if (!structureFormData.assignmentType) {
        toast.error('Please select assignment type (Employee or Role)');
        return;
      }

      if (structureFormData.assignmentType === 'employee' && !structureFormData.employeeId) {
        toast.error('Please select an employee');
        return;
      }

      if (structureFormData.assignmentType === 'role' && !structureFormData.role) {
        toast.error('Please enter a role');
        return;
      }

      if (!structureFormData.grossMonthlySalary || structureFormData.grossMonthlySalary <= 0) {
        toast.error('Please enter a valid gross monthly salary');
        return;
      }

      if (structureFormData.workingDaysRule === 'fixed_days' && (!structureFormData.fixedWorkingDays || structureFormData.fixedWorkingDays <= 0)) {
        toast.error('Please enter a valid number of fixed working days');
        return;
      }

      // Prepare payload - only send employeeId OR role, not both
      const payload: any = {
        grossMonthlySalary: structureFormData.grossMonthlySalary,
        workingDaysRule: structureFormData.workingDaysRule,
        paidLeaveTypes: structureFormData.paidLeaveTypes,
        unpaidLeaveTypes: structureFormData.unpaidLeaveTypes,
        halfDayDeductionRule: structureFormData.halfDayDeductionRule,
        effectiveFrom: structureFormData.effectiveFrom,
      };

      if (structureFormData.assignmentType === 'employee') {
        payload.employeeId = structureFormData.employeeId;
      } else if (structureFormData.assignmentType === 'role') {
        payload.role = structureFormData.role;
      }

      // Only include fixedWorkingDays when workingDaysRule is 'fixed_days'
      if (structureFormData.workingDaysRule === 'fixed_days') {
        payload.fixedWorkingDays = structureFormData.fixedWorkingDays;
      }

      const response = await fetch('/api/payroll/salary-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Salary structure created successfully');
        setStructureDialogOpen(false);
        resetStructureForm();
        fetchSalaryStructures();
      } else {
        // Safely format error message to prevent React rendering errors
        const errorMessage = formatErrorMessage(data.error, 'Failed to create salary structure');
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error creating salary structure:', error);
      const errorMessage = formatErrorMessage(error, 'Failed to create salary structure');
      toast.error(errorMessage);
    }
  };

  const resetStructureForm = () => {
    setStructureFormData({
      assignmentType: '',
      employeeId: '',
      role: '',
      grossMonthlySalary: 0,
      workingDaysRule: 'shift_based',
      fixedWorkingDays: 0,
      paidLeaveTypes: ['paid'],
      unpaidLeaveTypes: ['unpaid'],
      halfDayDeductionRule: 'half_day',
      effectiveFrom: new Date().toISOString().split('T')[0],
    });
    setEditingStructure(null);
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return months[month - 1];
  };

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payroll Management</h1>
          <p className="text-muted-foreground">Manage salary structures and process payroll</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={selectedMonth.toString()}
            onValueChange={(value) => setSelectedMonth(parseInt(value))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <SelectItem key={month} value={month.toString()}>
                  {getMonthName(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())}
            className="w-24"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 gap-1 bg-transparent p-0 h-auto border-b-2 border-border">
          <TabsTrigger
            value="dashboard"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
          >
            Dashboard
          </TabsTrigger>
          <TabsTrigger
            value="structures"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
          >
            Salary Structures
          </TabsTrigger>
          <TabsTrigger
            value="payrolls"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
          >
            Payrolls
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {dashboardStats && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{dashboardStats.summary.totalEmployees}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Processed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{dashboardStats.summary.processedCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{dashboardStats.summary.pendingCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Payroll</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">₹{dashboardStats.summary.totalPayrollCost.toFixed(2)}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Process Payroll</CardTitle>
                      <CardDescription>
                        Process payroll for {getMonthName(selectedMonth)} {selectedYear}
                      </CardDescription>
                    </div>
                    <Button onClick={handleProcessPayroll} disabled={processingPayroll}>
                      {processingPayroll ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <DollarSign className="h-4 w-4 mr-2" />
                          Process Payroll
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                {dashboardStats.summary.payrollsWithAnomalies > 0 && (
                  <CardContent>
                    <div className="flex items-center gap-2 text-orange-600">
                      <AlertTriangle className="h-4 w-4" />
                      <p className="text-sm">
                        {dashboardStats.summary.payrollsWithAnomalies} payroll(s) have anomalies that need attention
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>

              {dashboardStats.pendingEmployees.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Employees</CardTitle>
                    <CardDescription>Employees without payroll for this period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dashboardStats.pendingEmployees.map((emp) => (
                        <div key={emp._id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="font-medium">{emp.name}</p>
                            <p className="text-sm text-muted-foreground">{emp.employeeId}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Salary Structures Tab */}
        <TabsContent value="structures" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => {
              resetStructureForm();
              setStructureDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Salary Structure
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {salaryStructures.map((structure) => (
              <Card key={structure._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>
                        {structure.employeeId ? structure.employeeId.name : `Role: ${structure.role}`}
                      </CardTitle>
                      <CardDescription>
                        {structure.employeeId ? structure.employeeId.employeeId : structure.role}
                      </CardDescription>
                    </div>
                    <Badge variant={structure.isActive ? 'default' : 'secondary'}>
                      {structure.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Gross Salary</p>
                    <p className="text-lg font-bold">₹{structure.grossMonthlySalary.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Working Days Rule</p>
                    <p className="text-sm capitalize">{structure.workingDaysRule.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Effective From</p>
                    <p className="text-sm">{formatDate(structure.effectiveFrom)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Version</p>
                    <p className="text-sm">v{structure.version}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Payrolls Tab */}
        <TabsContent value="payrolls" className="space-y-4 mt-4">
          <div className="space-y-4">
            {payrolls.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No payroll records found for this period</p>
                </CardContent>
              </Card>
            ) : (
              payrolls.map((payroll) => (
                <Card key={payroll._id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{payroll.employeeId?.name || 'Employee Deleted'}</CardTitle>
                        <CardDescription>
                          {payroll.employeeId?.employeeId || 'N/A'} • {getMonthName(payroll.payrollMonth)} {payroll.payrollYear}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            payroll.status === 'locked'
                              ? 'default'
                              : payroll.status === 'processed'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {payroll.status}
                        </Badge>
                        {payroll.anomalies.length > 0 && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {payroll.anomalies.length} issue(s)
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Gross Payable</p>
                        <p className="text-lg font-bold">₹{payroll.grossPayable.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Deductions</p>
                        <p className="text-lg font-bold">₹{payroll.deductions.total.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Net Payable</p>
                        <p className="text-lg font-bold text-green-600">₹{payroll.netPayable.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Payable Days</p>
                        <p className="text-lg font-bold">{payroll.payableDays.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {payroll.status === 'processed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLockPayroll(payroll._id)}
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          Lock
                        </Button>
                      )}
                      {payroll.status === 'locked' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            fetch(`/api/payroll/${payroll._id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'unlock' }),
                            }).then(() => {
                              toast.success('Payroll unlocked');
                              fetchPayrolls();
                            });
                          }}
                        >
                          <Unlock className="h-4 w-4 mr-2" />
                          Unlock
                        </Button>
                      )}
                      {!payroll.payslipGenerated && payroll.status !== 'draft' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGeneratePayslip(payroll._id)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Generate Payslip
                        </Button>
                      )}
                      {payroll.payslipGenerated && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadPayslip(payroll._id)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Payslip
                        </Button>
                      )}
                    </div>
                    {payroll.anomalies.length > 0 && (
                      <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">Anomalies:</p>
                        <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                          {payroll.anomalies.map((anomaly, idx) => (
                            <li key={idx}>• {anomaly}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Salary Structure Dialog */}
      <Dialog open={structureDialogOpen} onOpenChange={setStructureDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Salary Structure</DialogTitle>
            <DialogDescription>Define salary structure for employee or role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Assign To *</Label>
              <Select
                value={structureFormData.assignmentType}
                onValueChange={(value: 'employee' | 'role') => {
                  setStructureFormData({ 
                    ...structureFormData, 
                    assignmentType: value,
                    employeeId: '', 
                    role: '' 
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="role">Role</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {structureFormData.assignmentType === 'employee' && (
              <div>
                <Label>Employee *</Label>
                <Select
                  value={structureFormData.employeeId}
                  onValueChange={(value) => setStructureFormData({ ...structureFormData, employeeId: value, role: '' })}
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

            {structureFormData.assignmentType === 'role' && (
              <div>
                <Label>Role *</Label>
                <Input
                  value={structureFormData.role}
                  onChange={(e) => setStructureFormData({ ...structureFormData, role: e.target.value, employeeId: '' })}
                  placeholder="e.g., Software Engineer"
                  required
                />
              </div>
            )}

            <div>
              <Label>Gross Monthly Salary (₹) *</Label>
              <Input
                type="number"
                value={structureFormData.grossMonthlySalary || ''}
                onChange={(e) =>
                  setStructureFormData({ ...structureFormData, grossMonthlySalary: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div>
              <Label>Working Days Rule *</Label>
              <Select
                value={structureFormData.workingDaysRule}
                onValueChange={(value: 'shift_based' | 'calendar_days' | 'fixed_days') =>
                  setStructureFormData({ 
                    ...structureFormData, 
                    workingDaysRule: value,
                    fixedWorkingDays: value === 'fixed_days' ? structureFormData.fixedWorkingDays : 0
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shift_based">Shift Based</SelectItem>
                  <SelectItem value="calendar_days">Calendar Days</SelectItem>
                  <SelectItem value="fixed_days">Fixed Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {structureFormData.workingDaysRule === 'fixed_days' && (
              <div>
                <Label>Fixed Working Days *</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={structureFormData.fixedWorkingDays || ''}
                  onChange={(e) =>
                    setStructureFormData({ ...structureFormData, fixedWorkingDays: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            )}

            <div>
              <Label>Half Day Deduction Rule</Label>
              <Select
                value={structureFormData.halfDayDeductionRule}
                onValueChange={(value: 'half_day' | 'proportional') =>
                  setStructureFormData({ ...structureFormData, halfDayDeductionRule: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="proportional">Proportional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Effective From *</Label>
              <Input
                type="date"
                value={structureFormData.effectiveFrom}
                onChange={(e) => setStructureFormData({ ...structureFormData, effectiveFrom: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setStructureDialogOpen(false);
              resetStructureForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateSalaryStructure}>
              Create Structure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

