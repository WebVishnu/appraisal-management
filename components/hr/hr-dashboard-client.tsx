'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Users,
  Calendar,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle,
  BarChart3,
  Plus,
  ArrowRight,
  Briefcase,
  ClipboardCheck,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';
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
import { formatPercentage } from '@/lib/utils/format';

interface DashboardStats {
  overview: {
    totalEmployees: number;
    totalEmployeesAll: number;
    activeCycles: number;
    totalCycles: number;
    pendingSelfReviews: number;
    pendingManagerReviews: number;
    averageRating: number;
  };
  completionRates: {
    selfReview: number;
    managerReview: number;
  };
  cyclesByStatus: {
    draft: number;
    open_self_review: number;
    open_manager_review: number;
    closed: number;
  };
  recentActivity: {
    selfReviewsSubmitted: number;
    managerReviewsSubmitted: number;
    totalSubmissions: number;
  };
  ratingDistribution: {
    '1': number;
    '2': number;
    '3': number;
    '4': number;
    '5': number;
  };
  leaves: {
    pending: number;
    approved: number;
    rejected: number;
    recent: number;
  };
  workReports: {
    pending: number;
    approved: number;
    returned: number;
    recent: number;
  };
  attendance: {
    todayCheckIns: number;
    thisMonthAttendance: number;
    attendanceRate: number;
  };
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function HRDashboardClient() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24 animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-16 animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div>Error loading dashboard data</div>;
  }

  const cycleStatusData = [
    { name: 'Draft', value: stats.cyclesByStatus.draft },
    { name: 'Self Review', value: stats.cyclesByStatus.open_self_review },
    { name: 'Manager Review', value: stats.cyclesByStatus.open_manager_review },
    { name: 'Closed', value: stats.cyclesByStatus.closed },
  ];

  const ratingData = [
    { name: '1-2', value: stats.ratingDistribution['1'] + stats.ratingDistribution['2'] },
    { name: '3', value: stats.ratingDistribution['3'] },
    { name: '4', value: stats.ratingDistribution['4'] },
    { name: '5', value: stats.ratingDistribution['5'] },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex gap-4 flex-wrap">
        <Button asChild>
          <Link href="/dashboard/hr/employees">
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/hr/cycles">
            <Plus className="h-4 w-4 mr-2" />
            Create Cycle
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/hr/reports">
            <BarChart3 className="h-4 w-4 mr-2" />
            View Reports
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/hr/leave">
            <Briefcase className="h-4 w-4 mr-2" />
            Leave Management
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/hr/work-reports">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Work Reports
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/hr/attendance">
            <UserCheck className="h-4 w-4 mr-2" />
            Attendance
          </Link>
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={stats.overview.totalEmployees}
          description={`${stats.overview.totalEmployeesAll} total (including inactive)`}
          icon={Users}
        />
        <StatCard
          title="Active Cycles"
          value={stats.overview.activeCycles}
          description={`${stats.overview.totalCycles} total cycles`}
          icon={Calendar}
        />
        <StatCard
          title="Pending Reviews"
          value={stats.overview.pendingSelfReviews + stats.overview.pendingManagerReviews}
          description={`${stats.overview.pendingSelfReviews} self, ${stats.overview.pendingManagerReviews} manager`}
          icon={Clock}
        />
        <StatCard
          title="Average Rating"
          value={stats.overview.averageRating.toFixed(1)}
          description="Across all closed cycles"
          icon={TrendingUp}
        />
      </div>

      {/* Leave, Work Reports & Attendance Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pending Leaves"
          value={stats.leaves.pending}
          description={`${stats.leaves.approved} approved, ${stats.leaves.recent} recent`}
          icon={Briefcase}
        />
        <StatCard
          title="Pending Work Reports"
          value={stats.workReports.pending}
          description={`${stats.workReports.approved} approved, ${stats.workReports.returned} returned`}
          icon={ClipboardCheck}
        />
        <StatCard
          title="Today's Check-ins"
          value={stats.attendance.todayCheckIns}
          description={`${stats.attendance.thisMonthAttendance} this month`}
          icon={UserCheck}
        />
        <StatCard
          title="Attendance Rate"
          value={`${stats.attendance.attendanceRate.toFixed(1)}%`}
          description="This month"
          icon={CheckCircle}
        />
      </div>

      {/* Completion Rates */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Completion Rates</CardTitle>
            <CardDescription>Review submission progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium dark:text-gray-300">Self Reviews</span>
                  <span className="text-sm font-bold dark:text-gray-100">{formatPercentage(stats.completionRates.selfReview)}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${stats.completionRates.selfReview}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium dark:text-gray-300">Manager Reviews</span>
                  <span className="text-sm font-bold dark:text-gray-100">{formatPercentage(stats.completionRates.managerReview)}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-600 dark:bg-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${stats.completionRates.managerReview}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm dark:text-gray-300">Self Reviews Submitted</span>
                </div>
                <span className="text-lg font-bold dark:text-gray-100">{stats.recentActivity.selfReviewsSubmitted}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm dark:text-gray-300">Manager Reviews Submitted</span>
                </div>
                <span className="text-lg font-bold dark:text-gray-100">{stats.recentActivity.managerReviewsSubmitted}</span>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium dark:text-gray-300">Total Submissions</span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    {stats.recentActivity.totalSubmissions}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cycles by Status</CardTitle>
            <CardDescription>Distribution of appraisal cycles</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={cycleStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {cycleStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>Performance ratings from closed cycles</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ratingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/hr/employees">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employee Management
              </CardTitle>
              <CardDescription>Create and manage employees, assign managers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                Go to Employees <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/hr/leave">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Leave Management
              </CardTitle>
              <CardDescription>Manage leave applications and balances</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                Go to Leaves <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/hr/work-reports">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Work Reports
              </CardTitle>
              <CardDescription>View productivity analytics and reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                View Reports <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/hr/attendance">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Attendance
              </CardTitle>
              <CardDescription>Monitor and manage employee attendance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                Go to Attendance <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/hr/cycles">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Appraisal Cycles
              </CardTitle>
              <CardDescription>Create and manage appraisal cycles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                Go to Cycles <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/hr/reports">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Reports & Analytics
              </CardTitle>
              <CardDescription>View appraisal reports and analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                View Reports <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}

