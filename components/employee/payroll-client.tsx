'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  DollarSign,
  Download,
  FileText,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { SkeletonCard } from '@/components/shared/skeleton-loader';

interface Payroll {
  _id: string;
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
  payslipGenerated: boolean;
}

export default function EmployeePayrollClient() {
  const [loading, setLoading] = useState(true);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchPayrolls();
  }, [selectedMonth, selectedYear]);

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/payroll/process?month=${selectedMonth}&year=${selectedYear}`);
      if (response.ok) {
        const data = await response.json();
        setPayrolls(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching payrolls:', error);
      toast.error('Failed to fetch payroll data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPayslip = async (payrollId: string) => {
    try {
      const response = await fetch(`/api/payroll/payslip/${payrollId}`);
      if (response.ok) {
        const payslip = await response.json();
        if (payslip.pdfUrl) {
          const link = document.createElement('a');
          link.href = payslip.pdfUrl;
          link.download = `payslip-${payslip.employeeIdString || payslip.employeeId}-${payslip.payrollMonth}-${payslip.payrollYear}.pdf`;
          link.click();
          toast.success('Payslip downloaded');
        }
      } else {
        toast.error('Payslip not available');
      }
    } catch (error) {
      console.error('Error downloading payslip:', error);
      toast.error('Failed to download payslip');
    }
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

  const currentPayroll = payrolls.find(
    (p) => p.payrollMonth === selectedMonth && p.payrollYear === selectedYear
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Payroll</h1>
          <p className="text-muted-foreground">View your salary details and download payslips</p>
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
          <input
            type="number"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())}
            className="w-24 px-3 py-2 border rounded-md"
          />
        </div>
      </div>

      {currentPayroll ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Payroll Summary</CardTitle>
                  <CardDescription>
                    {getMonthName(currentPayroll.payrollMonth)} {currentPayroll.payrollYear}
                  </CardDescription>
                </div>
                <Badge variant={currentPayroll.status === 'locked' ? 'default' : 'secondary'}>
                  {currentPayroll.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Gross Salary</p>
                  <p className="text-xl font-bold">₹{currentPayroll.grossMonthlySalary.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gross Payable</p>
                  <p className="text-xl font-bold">₹{currentPayroll.grossPayable.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Deductions</p>
                  <p className="text-xl font-bold text-red-600">₹{currentPayroll.deductions.total.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Payable</p>
                  <p className="text-xl font-bold text-green-600">₹{currentPayroll.netPayable.toFixed(2)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Payable Days</p>
                  <p className="text-lg font-semibold">{currentPayroll.payableDays.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Per Day Salary</p>
                  <p className="text-lg font-semibold">₹{currentPayroll.perDaySalary.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Working Days</p>
                  <p className="text-lg font-semibold">{currentPayroll.totalWorkingDays}</p>
                </div>
              </div>

              {currentPayroll.payslipGenerated && (
                <Button onClick={() => handleDownloadPayslip(currentPayroll._id)} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Payslip
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attendance Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Present Days</span>
                  <span className="font-medium">{currentPayroll.presentDays}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Absent Days</span>
                  <span className="font-medium">{currentPayroll.absentDays}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Half Days</span>
                  <span className="font-medium">{currentPayroll.halfDays}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Paid Leave Days</span>
                  <span className="font-medium">{currentPayroll.paidLeaveDays}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Unpaid Leave Days</span>
                  <span className="font-medium">{currentPayroll.unpaidLeaveDays}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Deductions Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Unpaid Leave</span>
                  <span className="font-medium">₹{currentPayroll.deductions.unpaidLeave.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Half Day</span>
                  <span className="font-medium">₹{currentPayroll.deductions.halfDay.toFixed(2)}</span>
                </div>
                {currentPayroll.deductions.latePenalty > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Late Penalty</span>
                    <span className="font-medium">₹{currentPayroll.deductions.latePenalty.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-semibold">Total Deductions</span>
                  <span className="font-bold text-red-600">₹{currentPayroll.deductions.total.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No payroll record found for {getMonthName(selectedMonth)} {selectedYear}</p>
          </CardContent>
        </Card>
      )}

      {/* Payroll History */}
      {payrolls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payroll History</CardTitle>
            <CardDescription>View past payroll records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {payrolls
                .sort((a, b) => {
                  if (a.payrollYear !== b.payrollYear) return b.payrollYear - a.payrollYear;
                  return b.payrollMonth - a.payrollMonth;
                })
                .map((payroll) => (
                  <div
                    key={payroll._id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => {
                      setSelectedMonth(payroll.payrollMonth);
                      setSelectedYear(payroll.payrollYear);
                    }}
                  >
                    <div>
                      <p className="font-medium">
                        {getMonthName(payroll.payrollMonth)} {payroll.payrollYear}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Net Payable: ₹{payroll.netPayable.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={payroll.status === 'locked' ? 'default' : 'secondary'}>
                        {payroll.status}
                      </Badge>
                      {payroll.payslipGenerated && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPayslip(payroll._id);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

