'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/stat-card';
import { SkeletonCard } from '@/components/shared/skeleton-loader';
import {
  FileText,
  Clock,
  TrendingUp,
  Target,
  Calendar,
  CheckCircle,
  ArrowRight,
  AlertCircle,
  Briefcase,
  ClipboardCheck,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatDate } from '@/lib/utils/format';

interface EmployeeDashboardStats {
  overview: {
    reviewsCompleted: number;
    pendingSelfReviews: number;
    averageRating: number;
    currentRating: string;
    activeCycles: number;
  };
  upcomingDeadlines: Array<{
    id: string;
    name: string;
    endDate: string;
    status: string;
    daysRemaining: number;
  }>;
  recentActivity: {
    submissions: number;
  };
  ratingTrend: Array<{
    cycle: string;
    rating: number;
    date: string;
  }>;
  latestReview: {
    cycleName: string;
    rating: string;
    submittedAt: string;
  } | null;
  leaves: {
    pending: number;
    approved: number;
    availableDays: number;
  };
  workReports: {
    pending: number;
    approved: number;
    returned: number;
  };
  attendance: {
    todayCheckedIn: boolean;
    todayStatus: string;
    thisMonthAttendance: number;
  };
}

export default function EmployeeDashboardClient() {
  const [stats, setStats] = useState<EmployeeDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/employee/dashboard');
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
            <SkeletonCard key={i} showTitle showDescription />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div>Error loading dashboard data</div>;
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex gap-4 flex-wrap">
        <Button asChild>
          <Link href="/dashboard/employee/appraisals">
            <FileText className="h-4 w-4 mr-2" />
            My Appraisals
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/employee/goals">
            <Target className="h-4 w-4 mr-2" />
            View Goals
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/employee/leave">
            <Briefcase className="h-4 w-4 mr-2" />
            Leave Management
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/employee/work-reports">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Work Reports
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/employee/attendance">
            <UserCheck className="h-4 w-4 mr-2" />
            Attendance
          </Link>
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Reviews Completed"
          value={stats.overview.reviewsCompleted}
          description="Total self-reviews submitted"
          icon={CheckCircle}
        />
        <StatCard
          title="Pending Reviews"
          value={stats.overview.pendingSelfReviews}
          description="Awaiting your submission"
          icon={Clock}
        />
        <StatCard
          title="Average Rating"
          value={stats.overview.averageRating.toFixed(1)}
          description="Across all appraisals"
          icon={TrendingUp}
        />
        <StatCard
          title="Current Rating"
          value={stats.overview.currentRating}
          description={stats.latestReview?.cycleName || 'Latest appraisal'}
          icon={Target}
        />
      </div>

      {/* Leave, Work Reports & Attendance Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pending Leaves"
          value={stats.leaves.pending}
          description={`${stats.leaves.approved} approved, ${stats.leaves.availableDays} days available`}
          icon={Briefcase}
        />
        <StatCard
          title="Work Reports"
          value={stats.workReports.pending}
          description={`${stats.workReports.approved} approved, ${stats.workReports.returned} returned`}
          icon={ClipboardCheck}
        />
        <StatCard
          title="Today's Status"
          value={stats.attendance.todayCheckedIn ? 'Checked In' : 'Not Checked In'}
          description={stats.attendance.todayStatus}
          icon={UserCheck}
        />
        <StatCard
          title="This Month"
          value={stats.attendance.thisMonthAttendance}
          description="Days present"
          icon={CheckCircle}
        />
      </div>

      {/* Upcoming Deadlines */}
      {stats.upcomingDeadlines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Upcoming Deadlines
            </CardTitle>
            <CardDescription>Appraisal cycles ending soon</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.upcomingDeadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div>
                    <p className="font-medium">{deadline.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Due: {formatDate(deadline.endDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold ${
                        deadline.daysRemaining <= 3
                          ? 'text-red-600 dark:text-red-400'
                          : deadline.daysRemaining <= 7
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {deadline.daysRemaining} {deadline.daysRemaining === 1 ? 'day' : 'days'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">remaining</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {stats.ratingTrend.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Performance Trend</CardTitle>
              <CardDescription>Your rating history</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.ratingTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="cycle" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Reviews Submitted</span>
                </div>
                <span className="text-lg font-bold">{stats.recentActivity.submissions}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">Pending Reviews</span>
                </div>
                <span className="text-lg font-bold">{stats.overview.pendingSelfReviews}</span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active Cycles</span>
                  <span className="text-xl font-bold text-green-600">
                    {stats.overview.activeCycles}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/employee/appraisals">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                My Appraisals
              </CardTitle>
              <CardDescription>View and submit your self-assessments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                Go to Appraisals <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/employee/leave">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Leave Management
              </CardTitle>
              <CardDescription>Apply for leave and check your balance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                Go to Leaves <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/employee/work-reports">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Work Reports
              </CardTitle>
              <CardDescription>Submit and view your work reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                Go to Reports <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/employee/attendance">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Attendance
              </CardTitle>
              <CardDescription>Check in/out and view attendance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                Go to Attendance <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/employee/performance-history">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Performance History
              </CardTitle>
              <CardDescription>View your complete performance history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                View History <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}

