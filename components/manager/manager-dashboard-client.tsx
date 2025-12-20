'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/stat-card';
import { SkeletonCard } from '@/components/shared/skeleton-loader';
import {
  Users,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle,
  Target,
  Calendar,
  ArrowRight,
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
  LineChart,
  Line,
} from 'recharts';
import { formatPercentage } from '@/lib/utils/format';

interface ManagerDashboardStats {
  overview: {
    teamSize: number;
    activeCycles: number;
    pendingReviews: number;
    completedReviews: number;
    completionRate: number;
    averageRating: number;
    healthScore: number;
  };
  memberCompletionStatus: Array<{
    employeeId: string;
    name: string;
    completed: number;
    pending: number;
    completionRate: number;
  }>;
  recentActivity: {
    submissions: number;
  };
  ratingDistribution: {
    '1-2': number;
    '3': number;
    '4': number;
    '5': number;
  };
}

export default function ManagerDashboardClient() {
  const [stats, setStats] = useState<ManagerDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/manager/dashboard');
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

  const ratingData = [
    { name: '1-2', value: stats.ratingDistribution['1-2'] },
    { name: '3', value: stats.ratingDistribution['3'] },
    { name: '4', value: stats.ratingDistribution['4'] },
    { name: '5', value: stats.ratingDistribution['5'] },
  ];

  const completionData = stats.memberCompletionStatus.map((member) => ({
    name: member.name.split(' ')[0], // First name only for chart
    completed: member.completed,
    pending: member.pending,
  }));

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex gap-2 sm:gap-4 flex-wrap">
        <Button asChild size="sm" className="text-xs sm:text-sm">
          <Link href="/dashboard/manager/reviews">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden xs:inline">Review Team</span>
            <span className="xs:hidden">Reviews</span>
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="text-xs sm:text-sm">
          <Link href="/dashboard/manager/goals">
            <Target className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Set Goals</span>
            <span className="sm:hidden">Goals</span>
          </Link>
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Team Size"
          value={stats.overview.teamSize}
          description="Active team members"
          icon={Users}
        />
        <StatCard
          title="Pending Reviews"
          value={stats.overview.pendingReviews}
          description={`${stats.overview.completedReviews} completed`}
          icon={Clock}
        />
        <StatCard
          title="Completion Rate"
          value={formatPercentage(stats.overview.completionRate)}
          description="Review submission progress"
          icon={CheckCircle}
        />
        <StatCard
          title="Team Health Score"
          value={stats.overview.healthScore}
          description="Overall team performance"
          icon={TrendingUp}
          trend={{
            value: stats.overview.averageRating,
            label: 'Avg Rating',
            isPositive: stats.overview.averageRating >= 3.5,
          }}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Team Completion Status</CardTitle>
            <CardDescription>Review completion by team member</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={completionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" fill="#10b981" name="Completed" />
                <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Rating Distribution</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Team performance ratings</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
              <BarChart data={ratingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Team Member Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Team Member Progress</CardTitle>
          <CardDescription>Individual completion rates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.memberCompletionStatus.map((member) => (
              <div key={member.employeeId}>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">{member.name}</span>
                  <span className="text-sm font-bold">
                    {formatPercentage(member.completionRate)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${member.completionRate}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>{member.completed} completed</span>
                  <span>{member.pending} pending</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/manager/reviews">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                Team Reviews
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Review and evaluate your team members</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium text-xs sm:text-sm">
                Go to Reviews <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link href="/dashboard/manager/calendar">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                Team Calendar
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">View team schedules and deadlines</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium text-xs sm:text-sm">
                View Calendar <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}

