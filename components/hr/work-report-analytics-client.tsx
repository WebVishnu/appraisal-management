'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Calendar,
  FileText,
} from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { SkeletonCard } from '@/components/shared/skeleton-loader';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsData {
  period: {
    startDate: string;
    endDate: string;
  };
  organization: {
    totalReports: number;
    totalEmployees: number;
    averageProductivityScore: number;
    totalWorkHours: number;
    averageWorkHours: number;
    taskCompletionRate: number;
    blockedTasks: number;
  };
  attendanceProductivityCorrelation: Array<{
    employeeId: string;
    employeeName: string;
    date: string;
    attendanceStatus: string;
    productivityScore: number;
    workHours: number;
    attendanceHours: number;
  }>;
  highPerformers: Array<{
    employeeId: string;
    employeeName: string;
    averageProductivityScore: number;
    averageWorkHours: number;
  }>;
  burnoutRisks: Array<{
    employeeId: string;
    employeeName: string;
    averageWorkHours: number;
    totalReports: number;
  }>;
  teamOverview: Array<{
    employeeId: string;
    employeeName: string;
    totalReports: number;
    averageProductivityScore: number;
    totalWorkHours: number;
    averageWorkHours: number;
    taskCompletionRate: number;
    blockedTasksCount: number;
    flags: string[];
  }> | null;
}

export default function WorkReportAnalyticsClient() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [teamId, setTeamId] = useState('');
  const [teams, setTeams] = useState<Array<{ _id: string; name: string; employeeId: string }>>([]);

  useEffect(() => {
    fetchAnalytics();
    fetchTeams();
  }, [startDate, endDate, teamId]);

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const employees = await response.json();
        const managers = employees.filter((emp: any) => emp.role === 'manager');
        setTeams(managers);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const url = `/api/reports/work/analytics?startDate=${startDate}&endDate=${endDate}${teamId ? `&teamId=${teamId}` : ''}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else {
        toast.error('Failed to fetch analytics');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <SkeletonCard />;
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No analytics data available
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const productivityTrend = analytics.attendanceProductivityCorrelation
    .slice(0, 30)
    .map(item => ({
      date: formatDate(item.date),
      productivity: item.productivityScore,
      workHours: item.workHours,
    }));

  const attendanceProductivityData = analytics.attendanceProductivityCorrelation.reduce((acc, item) => {
    const status = item.attendanceStatus;
    if (!acc[status]) {
      acc[status] = { count: 0, totalProductivity: 0 };
    }
    acc[status].count++;
    acc[status].totalProductivity += item.productivityScore;
    return acc;
  }, {} as Record<string, { count: number; totalProductivity: number }>);

  const attendanceProductivityChart = Object.entries(attendanceProductivityData).map(([status, data]) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1),
    averageProductivity: data.totalProductivity / data.count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Productivity Analytics</h1>
          <p className="text-muted-foreground">Organization-wide productivity insights and trends</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Team (Optional)</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Teams</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team._id} value={team._id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchAnalytics} className="w-full">
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.organization.totalReports}</div>
            <p className="text-xs text-muted-foreground">{analytics.organization.totalEmployees} employees</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Productivity</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.organization.averageProductivityScore.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">out of 100</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Work Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.organization.averageWorkHours.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">hours per report</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.organization.taskCompletionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{analytics.organization.blockedTasks} blocked</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Productivity Trend</CardTitle>
            <CardDescription>Productivity scores over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={productivityTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="productivity" stroke="#8884d8" name="Productivity Score" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance vs Productivity</CardTitle>
            <CardDescription>Average productivity by attendance status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceProductivityChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="averageProductivity" fill="#8884d8" name="Avg Productivity" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* High Performers */}
      {analytics.highPerformers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              High Performers
            </CardTitle>
            <CardDescription>Employees with productivity score ≥ 80 and ≥ 6 hours/day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.highPerformers.map((performer) => (
                <div key={performer.employeeId} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded">
                  <div>
                    <p className="font-medium">{performer.employeeName}</p>
                    <p className="text-sm text-muted-foreground">
                      Score: {performer.averageProductivityScore.toFixed(1)} • {performer.averageWorkHours.toFixed(1)}h/day
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Burnout Risks */}
      {analytics.burnoutRisks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Burnout Risks
            </CardTitle>
            <CardDescription>Employees working > 10 hours/day consistently</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.burnoutRisks.map((risk) => (
                <div key={risk.employeeId} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  <div>
                    <p className="font-medium">{risk.employeeName}</p>
                    <p className="text-sm text-muted-foreground">
                      {risk.averageWorkHours.toFixed(1)}h/day • {risk.totalReports} reports
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Overview */}
      {analytics.teamOverview && analytics.teamOverview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Team Overview</CardTitle>
            <CardDescription>Productivity metrics by team</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Employee</th>
                    <th className="text-right p-2">Reports</th>
                    <th className="text-right p-2">Avg Score</th>
                    <th className="text-right p-2">Avg Hours</th>
                    <th className="text-right p-2">Completion %</th>
                    <th className="text-right p-2">Blocked</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.teamOverview.map((member) => (
                    <tr key={member.employeeId} className="border-b">
                      <td className="p-2">{member.employeeName}</td>
                      <td className="text-right p-2">{member.totalReports}</td>
                      <td className="text-right p-2">{member.averageProductivityScore.toFixed(1)}</td>
                      <td className="text-right p-2">{member.averageWorkHours.toFixed(1)}h</td>
                      <td className="text-right p-2">{member.taskCompletionRate.toFixed(1)}%</td>
                      <td className="text-right p-2">{member.blockedTasksCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

