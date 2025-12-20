'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Star, CheckCircle, Clock } from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { SkeletonCard } from '@/components/shared/skeleton-loader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Feedback {
  _id: string;
  interviewId: {
    _id: string;
    interviewId: string;
    roundName: string;
  };
  candidateId: {
    _id: string;
    firstName: string;
    lastName: string;
    candidateId: string;
  };
  interviewerId: {
    _id: string;
    email: string;
  };
  overallScore: number;
  overallRecommendation: string;
  recommendation: 'hire' | 'maybe' | 'reject';
  isSubmitted: boolean;
  submittedAt?: string;
}

export default function FeedbackTab() {
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [submittedFilter, setSubmittedFilter] = useState<string>('all');

  useEffect(() => {
    fetchFeedbacks();
  }, [submittedFilter]);

  // Listen for refresh event from interviews tab
  useEffect(() => {
    const handleRefresh = () => {
      fetchFeedbacks();
    };

    window.addEventListener('refreshFeedbackTab', handleRefresh);
    return () => {
      window.removeEventListener('refreshFeedbackTab', handleRefresh);
    };
  }, []);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (submittedFilter === 'submitted') {
        params.append('submitted', 'true');
      } else if (submittedFilter === 'pending') {
        params.append('submitted', 'false');
      }

      const response = await fetch(`/api/interviews/feedback?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setFeedbacks(data);
      } else {
        toast.error('Failed to fetch feedback');
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast.error('Error fetching feedback');
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'hire':
      case 'strong_yes':
      case 'yes':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'maybe':
      case 'hold':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'reject':
      case 'no':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold">Interview Feedback</h2>
        <p className="text-sm text-muted-foreground">View and manage interview feedback</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div>
              <Select value={submittedFilter} onValueChange={setSubmittedFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Feedback</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Table */}
      <Card>
        <CardHeader>
          <CardTitle>Interview Feedback</CardTitle>
          <CardDescription>{feedbacks.length} feedback(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {feedbacks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No feedback found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Interviewer</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Recommendation</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedbacks.map((feedback) => (
                    <TableRow key={feedback._id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {feedback.candidateId.firstName} {feedback.candidateId.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{feedback.candidateId.candidateId}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{feedback.interviewId.roundName}</p>
                        <p className="text-xs text-muted-foreground">{feedback.interviewId.interviewId}</p>
                      </TableCell>
                      <TableCell className="text-sm">{feedback.interviewerId.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{feedback.overallScore}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRecommendationColor(feedback.overallRecommendation)}>
                          {feedback.overallRecommendation.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRecommendationColor(feedback.recommendation)}>
                          {feedback.recommendation}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {feedback.isSubmitted ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Submitted
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {feedback.submittedAt ? formatDate(feedback.submittedAt) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

