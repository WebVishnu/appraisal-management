'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  ArrowLeft,
  Mail,
  User,
  Calendar,
  TrendingUp,
  FileText,
  Users,
  Edit,
} from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
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
import Link from 'next/link';

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

interface Review {
  type: 'manager' | 'self';
  cycleId: {
    _id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  rating: string | null;
  submittedAt: string | null;
  createdAt: string;
  status: string;
}

interface EmployeeProfileData {
  employee: Employee;
  reviews: Review[];
  statistics: {
    totalReviews: number;
    averageRating: number;
    ratings: number[];
  };
  managerHierarchy: Array<{
    _id: string;
    name: string;
    employeeId: string;
    email: string;
  }>;
}

export default function EmployeeProfileClient() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<EmployeeProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchEmployeeProfile(params.id as string);
    }
  }, [params.id]);

  const fetchEmployeeProfile = async (id: string) => {
    try {
      const response = await fetch(`/api/employees/${id}`);
      if (response.ok) {
        const profileData = await response.json();
        setData(profileData);
      } else {
        console.error('Failed to fetch employee profile');
      }
    } catch (error) {
      console.error('Error fetching employee profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!data) {
    return <div>Employee not found</div>;
  }

  const { employee, reviews, statistics, managerHierarchy } = data;

  // Prepare chart data
  const chartData = reviews
    .filter((r) => r.type === 'manager' && r.rating && r.cycleId)
    .map((r) => {
      const match = r.rating?.match(/(\d+\.?\d*)/);
      const rating = match ? parseFloat(match[1]) : null;
      return {
        cycle: r.cycleId.name,
        rating: rating || 0,
        date: r.cycleId.startDate,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{employee.name}</h1>
            <p className="text-gray-600 dark:text-gray-400">{employee.employeeId}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={employee.isActive ? 'active' : 'inactive'} />
          <Button variant="outline" asChild>
            <Link href={`/dashboard/hr/employees?edit=${employee._id}`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Profile Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {employee.email}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Role</p>
              <p className="font-medium">{employee.role}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Employee ID</p>
              <p className="font-medium">{employee.employeeId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Joined</p>
              <p className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatDate(employee.createdAt)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Total Reviews</p>
              <p className="text-2xl font-bold">{statistics.totalReviews}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Average Rating</p>
              <p className="text-2xl font-bold">{statistics.averageRating.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <StatusBadge status={employee.isActive ? 'active' : 'inactive'} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Manager
            </CardTitle>
          </CardHeader>
          <CardContent>
            {employee.managerId ? (
              <div>
                <p className="font-medium">{employee.managerId.name}</p>
                <p className="text-sm text-gray-500">{employee.managerId.email}</p>
                <p className="text-xs text-gray-400 mt-1">{employee.managerId.employeeId}</p>
              </div>
            ) : (
              <p className="text-gray-400 italic">No manager assigned</p>
            )}
            {managerHierarchy.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-500 mb-2">Reporting Chain</p>
                <div className="space-y-1">
                  {managerHierarchy.map((manager, idx) => (
                    <div key={manager._id} className="text-xs text-gray-600 dark:text-gray-400">
                      {idx + 1}. {manager.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Trend Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Trend</CardTitle>
            <CardDescription>Rating history across appraisal cycles</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
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

      {/* Appraisal History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Appraisal History
          </CardTitle>
          <CardDescription>Complete history of all appraisals</CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No appraisal history available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review, index) => (
                <div
                  key={index}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{review.cycleId.name}</h4>
                        <StatusBadge status={review.cycleId.status} size="sm" />
                        <span className="text-xs text-gray-500">
                          {review.type === 'manager' ? 'Manager Review' : 'Self Review'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Period:</span>{' '}
                          <span className="font-medium">
                            {formatDate(review.cycleId.startDate)} - {formatDate(review.cycleId.endDate)}
                          </span>
                        </div>
                        {review.rating && (
                          <div>
                            <span className="text-gray-500">Rating:</span>{' '}
                            <span className="font-bold text-lg">{review.rating}</span>
                          </div>
                        )}
                        {review.submittedAt && (
                          <div>
                            <span className="text-gray-500">Submitted:</span>{' '}
                            <span className="font-medium">{formatDate(review.submittedAt)}</span>
                          </div>
                        )}
                        <div>
                          <StatusBadge status={review.status} size="sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

