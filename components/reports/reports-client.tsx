'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Download } from 'lucide-react';

interface Cycle {
  _id: string;
  name: string;
}

interface Employee {
  _id: string;
  name: string;
  employeeId: string;
}

interface Report {
  _id: string;
  cycleId: {
    _id: string;
    name: string;
    startDate: string;
    endDate: string;
    status?: string;
  };
  employeeId: {
    _id: string;
    name: string;
    employeeId: string;
    email: string;
  };
  managerId: {
    _id?: string;
    name?: string;
    employeeId?: string;
    email?: string;
  } | null;
  ratings: Record<string, number | string>;
  managerComments: string;
  finalRating: string;
  status: 'draft' | 'submitted';
  submittedAt?: string | null;
  selfReview?: {
    ratings: Record<string, number | string>;
    comments: string;
    status: 'draft' | 'submitted';
    submittedAt?: string | null;
  } | null;
  isIncomplete?: boolean;
}

export default function ReportsClient() {
  const [reports, setReports] = useState<Report[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    cycleId: 'all',
    managerId: 'all',
    employeeId: 'all',
  });
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchCycles();
    fetchEmployees();
    fetchManagers();
    fetchReports();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [filters]);

  const fetchCycles = async () => {
    try {
      const response = await fetch('/api/cycles');
      if (response.ok) {
        const data = await response.json();
        setCycles(data);
      }
    } catch (error) {
      console.error('Error fetching cycles:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchManagers = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        // Filter for managers
        setManagers(data.filter((emp: Employee) => emp.employeeId.startsWith('MGR')));
      }
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.cycleId && filters.cycleId !== 'all') params.append('cycleId', filters.cycleId);
      if (filters.managerId && filters.managerId !== 'all') params.append('managerId', filters.managerId);
      if (filters.employeeId && filters.employeeId !== 'all') params.append('employeeId', filters.employeeId);

      const response = await fetch(`/api/reports?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setReports(data);
        if (data.length === 0 && (filters.cycleId !== 'all' || filters.managerId !== 'all' || filters.employeeId !== 'all')) {
          toast.info('No reports found matching the selected filters');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch reports:', errorData);
        toast.error(errorData.error || 'Failed to fetch reports');
      }
    } catch (error) {
      toast.error('Error fetching reports');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (report: Report) => {
    setSelectedReport(report);
    setIsDialogOpen(true);
  };

  const clearFilters = () => {
    setFilters({ cycleId: 'all', managerId: 'all', employeeId: 'all' });
  };

  const exportToCSV = () => {
    if (reports.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Cycle', 'Employee', 'Email', 'Manager', 'Manager Email', 'Final Rating', 'Status', 'Submitted'];
    const rows = reports.map((report) => [
      report.cycleId.name,
      report.employeeId.name,
      report.employeeId.email,
      report.managerId?.name || 'N/A',
      report.managerId?.email || 'N/A',
      report.finalRating || 'Pending',
      report.status,
      report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `appraisal-reports-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported successfully');
  };

  // Prepare chart data
  const ratingDistribution = reports.reduce((acc, report) => {
    if (report.finalRating && !report.isIncomplete) {
      const match = report.finalRating.match(/(\d+\.?\d*)/);
      if (match) {
        const rating = Math.round(parseFloat(match[1]));
        acc[rating] = (acc[rating] || 0) + 1;
      }
    }
    return acc;
  }, {} as Record<number, number>);

  const chartData = Object.entries(ratingDistribution)
    .map(([rating, count]) => ({
      rating: `Rating ${rating}`,
      count,
    }))
    .sort((a, b) => parseInt(a.rating.split(' ')[1]) - parseInt(b.rating.split(' ')[1]));

  const statusDistribution = reports.reduce((acc, report) => {
    acc[report.status] = (acc[report.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = Object.entries(statusDistribution).map(([status, count]) => ({
    status: status === 'submitted' ? 'Submitted' : 'Draft',
    count,
  }));

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

  if (loading && reports.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 rounded w-48 animate-pulse"></div>
        <Card>
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-48 animate-pulse mt-2"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Appraisal Reports</h2>
          <p className="text-gray-600 dark:text-gray-400">View and analyze appraisal data</p>
        </div>
        {reports.length > 0 && (
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter reports by cycle, manager, or employee</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cycle-filter">Cycle</Label>
              <Select
                value={filters.cycleId}
                onValueChange={(value) => setFilters({ ...filters, cycleId: value })}
              >
                <SelectTrigger id="cycle-filter">
                  <SelectValue placeholder="All cycles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cycles</SelectItem>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle._id} value={cycle._id}>
                      {cycle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manager-filter">Manager</Label>
              <Select
                value={filters.managerId}
                onValueChange={(value) => setFilters({ ...filters, managerId: value })}
              >
                <SelectTrigger id="manager-filter">
                  <SelectValue placeholder="All managers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All managers</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager._id} value={manager._id}>
                      {manager.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee-filter">Employee</Label>
              <Select
                value={filters.employeeId}
                onValueChange={(value) => setFilters({ ...filters, employeeId: value })}
              >
                <SelectTrigger id="employee-filter">
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee._id} value={employee._id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>
            {reports.length} report{reports.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No reports found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Final Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report._id}>
                    <TableCell>{report.cycleId.name}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{report.employeeId.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{report.employeeId.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {report.managerId && report.managerId.name ? (
                        <div>
                          <div className="font-medium dark:text-gray-100">{report.managerId.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{report.managerId.email}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 italic">No manager review</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium dark:text-gray-100">
                        {report.isIncomplete ? (
                          <span className="text-gray-400 dark:text-gray-500 italic">Pending</span>
                        ) : (
                          report.finalRating
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          report.status === 'submitted'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {report.status === 'submitted' ? 'Submitted' : 'Draft'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {report.submittedAt
                        ? new Date(report.submittedAt).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(report)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      {reports.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Rating Distribution</CardTitle>
              <CardDescription>Distribution of final ratings</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="rating" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">No rating data available</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
              <CardDescription>Submitted vs Draft reports</CardDescription>
            </CardHeader>
            <CardContent>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props: any) => {
                        const percent = props.percent || 0;
                        const name = props.name || props.status || '';
                        return `${name}: ${(percent * 100).toFixed(0)}%`;
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">No status data available</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-[hsl(var(--foreground))]">Report Details</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-[hsl(var(--muted-foreground))]">
              Detailed view of the appraisal report
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Cycle</Label>
                  <p className="font-medium">{selectedReport.cycleId.name}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(selectedReport.cycleId.startDate).toLocaleDateString()} -{' '}
                    {new Date(selectedReport.cycleId.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Final Rating</Label>
                  <p className="font-medium text-lg">{selectedReport.finalRating}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Employee</Label>
                <p className="font-medium">{selectedReport.employeeId.name}</p>
                <p className="text-sm text-gray-500">{selectedReport.employeeId.email}</p>
              </div>
              {selectedReport.managerId && selectedReport.managerId.name ? (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Manager</Label>
                  <p className="font-medium">{selectedReport.managerId.name}</p>
                  <p className="text-sm text-gray-500">{selectedReport.managerId.email}</p>
                </div>
              ) : (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Manager</Label>
                  <p className="text-gray-400 italic">No manager review available</p>
                </div>
              )}
              
              {selectedReport.selfReview && (
                <div>
                  <Label className="text-sm font-medium text-gray-500 mb-2 block">
                    Employee Self-Review
                  </Label>
                  <div className="space-y-2 mb-4">
                    {Object.entries(selectedReport.selfReview.ratings).map(([key, value]) => (
                      <div key={key} className="flex justify-between border-b pb-2">
                        <span className="font-medium">{key}</span>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                  {selectedReport.selfReview.comments && (
                    <div className="mb-4">
                      <Label className="text-sm font-medium text-gray-500 mb-2 block">
                        Employee Comments
                      </Label>
                      <p className="text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded">
                        {selectedReport.selfReview.comments}
                      </p>
                    </div>
                  )}
                  <div className="mb-4">
                    <Label className="text-sm font-medium text-gray-500">Self-Review Status</Label>
                    <p className="text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          selectedReport.selfReview.status === 'submitted'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {selectedReport.selfReview.status === 'submitted' ? 'Submitted' : 'Draft'}
                      </span>
                      {selectedReport.selfReview.submittedAt && (
                        <span className="ml-2 text-xs text-gray-500">
                          on {new Date(selectedReport.selfReview.submittedAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {!selectedReport.isIncomplete && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">Manager Ratings</Label>
                    <div className="space-y-2">
                      {Object.keys(selectedReport.ratings).length > 0 ? (
                        Object.entries(selectedReport.ratings).map(([key, value]) => (
                          <div key={key} className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                            <span className="font-medium dark:text-gray-100">{key}</span>
                            <span className="dark:text-gray-300">{value}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-400 dark:text-gray-500 italic">No ratings provided</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">
                      Manager Comments
                    </Label>
                    <p className="text-sm whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      {selectedReport.managerComments || 'No comments'}
                    </p>
                  </div>
                </>
              )}
              
              <div>
                <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Submitted At</Label>
                <p className="text-sm dark:text-gray-300">
                  {selectedReport.submittedAt
                    ? new Date(selectedReport.submittedAt).toLocaleString()
                    : 'Not submitted'}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

