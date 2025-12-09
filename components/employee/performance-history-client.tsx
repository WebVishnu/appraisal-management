'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { SkeletonCard } from '@/components/shared/skeleton-loader';
import { EmptyReviews } from '@/components/shared/empty-state';
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
import { FileText, TrendingUp } from 'lucide-react';

interface Review {
  _id: string;
  cycleId: {
    _id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  finalRating: string;
  submittedAt: string;
  managerComments: string;
}

interface PerformanceHistoryData {
  reviews: Review[];
  ratingTrend: Array<{
    cycle: string;
    rating: number;
    date: string;
  }>;
  statistics: {
    totalReviews: number;
    averageRating: number;
    highestRating: string;
    lowestRating: string;
  };
}

export default function EmployeePerformanceHistoryClient() {
  const [data, setData] = useState<PerformanceHistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformanceHistory();
  }, []);

  const fetchPerformanceHistory = async () => {
    try {
      // Use the employee profile API to get review history
      const response = await fetch('/api/employees/me');
      if (response.ok) {
        const profileData = await response.json();
        // Transform the data for performance history view
        const managerReviews = profileData.reviews?.filter((r: any) => r.type === 'manager') || [];
        const ratingTrend = managerReviews
          .map((r: any) => {
            const match = r.rating?.match(/(\d+\.?\d*)/);
            return {
              cycle: r.cycleId?.name || 'Unknown',
              rating: match ? parseFloat(match[1]) : null,
              date: r.cycleId?.startDate || new Date().toISOString(),
            };
          })
          .filter((r: any): r is { cycle: string; rating: number; date: string } => r.rating !== null)
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const ratings = ratingTrend.map((r: { cycle: string; rating: number; date: string }) => r.rating);
        const averageRating = ratings.length > 0
          ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
          : 0;

        setData({
          reviews: managerReviews.map((r: any) => ({
            _id: r.cycleId?._id || '',
            cycleId: {
              _id: r.cycleId?._id || '',
              name: r.cycleId?.name || 'Unknown',
              startDate: r.cycleId?.startDate || '',
              endDate: r.cycleId?.endDate || '',
              status: r.cycleId?.status || 'closed',
            },
            finalRating: r.rating || 'N/A',
            submittedAt: r.submittedAt || '',
            managerComments: '',
          })),
          ratingTrend,
          statistics: {
            totalReviews: managerReviews.length,
            averageRating,
            highestRating: ratings.length > 0 ? Math.max(...ratings).toFixed(1) : 'N/A',
            lowestRating: ratings.length > 0 ? Math.min(...ratings).toFixed(1) : 'N/A',
          },
        });
      }
    } catch (error) {
      console.error('Error fetching performance history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard showTitle showDescription />
        <SkeletonCard showTitle showDescription />
      </div>
    );
  }

  if (!data || data.reviews.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyReviews />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Reviews</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.statistics.totalReviews}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.statistics.averageRating.toFixed(1)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Highest Rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.statistics.highestRating}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Lowest Rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.statistics.lowestRating}</div>
          </CardContent>
        </Card>
      </div>

      {/* Rating Trend Chart */}
      {data.ratingTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Trend
            </CardTitle>
            <CardDescription>Your rating history across appraisal cycles</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.ratingTrend}>
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
                  name="Rating"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Review History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Complete Review History
          </CardTitle>
          <CardDescription>All your performance reviews</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.reviews.map((review) => (
              <div
                key={review._id}
                className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {review.cycleId.name}
                      </h4>
                      <StatusBadge status={review.cycleId.status} size="sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Period:</span>{' '}
                        <span className="font-medium">
                          {formatDate(review.cycleId.startDate)} - {formatDate(review.cycleId.endDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Rating:</span>{' '}
                        <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                          {review.finalRating}
                        </span>
                      </div>
                      {review.submittedAt && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Submitted:</span>{' '}
                          <span className="font-medium">{formatDate(review.submittedAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

