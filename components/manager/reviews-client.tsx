'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Users,
  FileText,
  CheckCircle,
  Clock,
  Star,
  TrendingUp,
  Calendar as CalendarIcon,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { SkeletonCard } from '@/components/shared/skeleton-loader';
import { formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils';

interface Competency {
  name: string;
  type: 'rating' | 'text';
  maxRating?: number;
}

interface Cycle {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'open_self_review' | 'open_manager_review' | 'closed';
  competencies: Competency[];
}

interface Employee {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
}

interface SelfReview {
  _id: string;
  cycleId: string | { _id: string; name: string; status: string };
  employeeId: string | { _id: string; name: string; email: string; employeeId: string };
  status: 'draft' | 'submitted';
  submittedAt?: string | Date;
  createdAt?: string | Date;
}

interface ManagerReview {
  _id: string;
  cycleId: Cycle;
  employeeId: Employee;
  ratings: Record<string, number | string>;
  managerComments: string;
  finalRating: string;
  status: 'draft' | 'submitted';
}

export default function ManagerReviewsClient() {
  const [teamMembers, setTeamMembers] = useState<Employee[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [reviews, setReviews] = useState<ManagerReview[]>([]);
  const [selfReviews, setSelfReviews] = useState<SelfReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedCycleData, setSelectedCycleData] = useState<Cycle | null>(null);
  const [formData, setFormData] = useState<{
    ratings: Record<string, number | string>;
    managerComments: string;
    finalRating: string;
  }>({
    ratings: {},
    managerComments: '',
    finalRating: '',
  });

  useEffect(() => {
    fetchTeamMembers();
    fetchCycles();
  }, []);

  useEffect(() => {
    if (selectedCycle) {
      fetchReviews();
      fetchSelfReviews();
    }
  }, [selectedCycle]);

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch('/api/employees/team');
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data);
      }
    } catch (error) {
      toast.error('Error fetching team members');
    }
  };

  const fetchCycles = async () => {
    try {
      const response = await fetch('/api/cycles/active?status=open_manager_review');
      const closedResponse = await fetch('/api/cycles/active?status=closed');

      if (response.ok && closedResponse.ok) {
        const openData = await response.json();
        const closedData = await closedResponse.json();
        setCycles([...openData, ...closedData]);
      }
    } catch (error) {
      toast.error('Error fetching cycles');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await fetch(`/api/reviews/manager?cycleId=${selectedCycle}`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data);
      }
    } catch (error) {
      toast.error('Error fetching reviews');
    }
  };

  const fetchSelfReviews = async () => {
    try {
      // Fetch self reviews for all team members for the selected cycle
      const response = await fetch(`/api/reviews/team-self?cycleId=${selectedCycle}`);
      if (response.ok) {
        const data = await response.json();
        setSelfReviews(data);
      } else {
        console.error('Failed to fetch team self reviews:', response.status);
      }
    } catch (error) {
      console.error('Error fetching self reviews:', error);
    }
  };

  const handleStartReview = (employee: Employee, cycle: Cycle) => {
    const existingReview = reviews.find(
      (r) =>
        (r.employeeId as any)._id === employee._id &&
        ((r.cycleId as any)._id === cycle._id || (r.cycleId as any).toString() === cycle._id)
    );

    if (existingReview && existingReview.status === 'submitted') {
      toast.error('This review has already been submitted');
      return;
    }

    // Managers can now give reviews regardless of whether employee has submitted self-review
    // Self-review status is shown for informational purposes only

    setSelectedEmployee(employee);
    setSelectedCycleData(cycle);
    if (existingReview) {
      setFormData({
        ratings: existingReview.ratings || {},
        managerComments: existingReview.managerComments || '',
        finalRating: existingReview.finalRating || '',
      });
    } else {
      const initialRatings: Record<string, number | string> = {};
      cycle.competencies.forEach((comp) => {
        initialRatings[comp.name] = comp.type === 'rating' ? 0 : '';
      });
      setFormData({
        ratings: initialRatings,
        managerComments: '',
        finalRating: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent, submit: boolean = false) => {
    e.preventDefault();

    if (!selectedEmployee || !selectedCycleData) return;

    if (!formData.finalRating) {
      toast.error('Please provide a final rating');
      return;
    }

    // Validate ratings
    for (const comp of selectedCycleData.competencies) {
      const value = formData.ratings[comp.name];
      if (comp.type === 'rating') {
        const numValue = typeof value === 'string' ? parseInt(value) : value;
        if (!numValue || numValue < 1 || numValue > (comp.maxRating || 5)) {
          toast.error(`Please provide a valid rating for ${comp.name} (1-${comp.maxRating || 5})`);
          return;
        }
      } else if (!value || (typeof value === 'string' && value.trim() === '')) {
        toast.error(`Please fill in ${comp.name}`);
        return;
      }
    }

    try {
      const response = await fetch('/api/reviews/manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId: selectedCycleData._id,
          employeeId: selectedEmployee._id,
          ratings: formData.ratings,
          managerComments: formData.managerComments,
          finalRating: formData.finalRating,
          status: submit ? 'submitted' : 'draft',
        }),
      });

      if (response.ok) {
        toast.success(submit ? 'Review submitted successfully' : 'Review saved as draft');
        setIsDialogOpen(false);
        fetchReviews();
        fetchSelfReviews(); // Refresh self reviews to update status
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save review');
      }
    } catch (error) {
      toast.error('Error saving review');
    }
  };

  const getReviewForEmployee = (employeeId: string) => {
    return reviews.find(
      (r) => (r.employeeId as any)._id === employeeId || (r.employeeId as any).toString() === employeeId
    );
  };

  const hasSelfReview = (employeeId: string) => {
    return selfReviews.some(
      (r) => {
        const reviewEmployeeId = (r.employeeId as any)?._id || (r.employeeId as any)?.toString() || r.employeeId;
        const targetEmployeeId = employeeId.toString();
        return (
          reviewEmployeeId.toString() === targetEmployeeId &&
          r.status === 'submitted'
        );
      }
    );
  };

  const currentCycle = cycles.find((c) => c._id === selectedCycle);

  // Calculate statistics
  const stats = {
    total: teamMembers.length,
    reviewed: reviews.filter(r => r.status === 'submitted').length,
    draft: reviews.filter(r => r.status === 'draft').length,
    pending: teamMembers.length - reviews.length,
    withSelfReview: teamMembers.filter(e => hasSelfReview(e._id)).length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard showTitle showDescription />
        <SkeletonCard showTitle showDescription />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cycle Selection - Card Based */}
      <Card className="bg-white dark:bg-[hsl(var(--card))]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-[hsl(var(--foreground))]">
            <CalendarIcon className="h-5 w-5" />
            Select Appraisal Cycle
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-[hsl(var(--muted-foreground))]">Choose a cycle to review your team members</CardDescription>
        </CardHeader>
        <CardContent>
          {cycles.length === 0 ? (
            <div className="text-center py-8">
              <CalendarIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                No cycles available
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {cycles.map((cycle) => {
                const isSelected = selectedCycle === cycle._id;
                const cycleReviews = reviews.filter(r =>
                  (r.cycleId as any)?._id === cycle._id || (r.cycleId as any)?.toString() === cycle._id
                );
                const submittedCount = cycleReviews.filter(r => r.status === 'submitted').length;
                const draftCount = cycleReviews.filter(r => r.status === 'draft').length;

                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'open_manager_review':
                      return 'border-green-500 dark:border-green-400 bg-green-500/10 hover:bg-green-100/80 dark:hover:bg-green-900/15';
                    case 'closed':
                      return 'border-gray-500 dark:border-gray-600 bg-gray-500/10 hover:bg-gray-100 dark:hover:bg-gray-800/60';
                    case 'open_self_review':
                      return 'border-blue-500 dark:border-blue-400 bg-blue-500/10 hover:bg-blue-100/80 dark:hover:bg-blue-900/15';
                    default:
                      return 'border-yellow-500 dark:border-yellow-400 bg-yellow-500/10 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/15';
                  }
                };

                const getStatusBadgeColor = (status: string) => {
                  switch (status) {
                    case 'open_manager_review':
                      return 'bg-green-500 text-white border border-green-300 font-semibold';
                    case 'closed':
                      return 'bg-gray-500 text-white border border-gray-300 font-semibold';
                    case 'open_self_review':
                      return 'bg-blue-500 text-white border border-blue-300 font-semibold';
                    default:
                      return 'bg-yellow-500 text-white border border-yellow-300 font-semibold';
                  }
                };

                return (
                  <div
                    key={cycle._id}
                    onClick={() => setSelectedCycle(cycle._id)}
                    className={cn(
                      'relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md dark:hover:shadow-lg',
                      isSelected
                        ? 'border-blue-500 dark:border-blue-400 bg-blue-100 dark:bg-blue-900/20 shadow-md dark:shadow-blue-900/20 ring-2 ring-blue-300 dark:ring-blue-800'
                        : getStatusColor(cycle.status),
                      'hover:scale-[1.02]'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-[hsl(var(--foreground))] text-lg mb-1">
                          {cycle.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-[hsl(var(--muted-foreground))]">
                          <CalendarIcon className="h-3 w-3 text-gray-600 dark:text-[hsl(var(--muted-foreground))]" />
                          <span>
                            {formatDate(cycle.startDate)} - {formatDate(cycle.endDate)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-semibold',
                            getStatusBadgeColor(cycle.status)
                          )}
                        >
                          {cycle.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {cycleReviews.length > 0 && (
                          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-[hsl(var(--muted-foreground))]">
                            {submittedCount > 0 && (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                                {submittedCount}
                              </span>
                            )}
                            {draftCount > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                                {draftCount}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                          <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                            ✓ Currently selected
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      
      {!selectedCycle && cycles.length === 0 && !loading && (
        <Card className="bg-white dark:bg-[hsl(var(--card))]">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-[hsl(var(--foreground))] mb-2">
                No Appraisal Cycles Available
              </h3>
              <p className="text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                There are no cycles available for review. Please contact HR to create a new cycle.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      {selectedCycle && currentCycle && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500 dark:border-l-blue-400 bg-white dark:bg-[hsl(var(--card))]">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2 text-gray-600 dark:text-[hsl(var(--muted-foreground))]">
                <Users className="h-4 w-4" />
                Team Members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">
                {stats.total}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 dark:border-l-green-400 bg-white dark:bg-[hsl(var(--card))]">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2 text-gray-600 dark:text-[hsl(var(--muted-foreground))]">
                <CheckCircle className="h-4 w-4" />
                Reviews Submitted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.reviewed}
              </div>
              <p className="text-xs text-gray-500 dark:text-[hsl(var(--muted-foreground))] mt-1">
                {stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0}% complete
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-500 dark:border-l-yellow-400 bg-white dark:bg-[hsl(var(--card))]">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2 text-gray-600 dark:text-[hsl(var(--muted-foreground))]">
                <Clock className="h-4 w-4" />
                Draft Reviews
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.draft}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 dark:border-l-purple-400 bg-white dark:bg-[hsl(var(--card))]">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2 text-gray-600 dark:text-[hsl(var(--muted-foreground))]">
                <UserCheck className="h-4 w-4" />
                With Self-Review
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.withSelfReview}
              </div>
            </CardContent>
          </Card>
        </div>
      )}



      {selectedCycle && currentCycle && (
        <Card className="bg-white dark:bg-[hsl(var(--card))]">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl text-gray-900 dark:text-[hsl(var(--foreground))]">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  {currentCycle.name}
                </CardTitle>
                <CardDescription className="mt-2 flex items-center gap-2 text-gray-600 dark:text-[hsl(var(--muted-foreground))]">
                  <CalendarIcon className="h-4 w-4" />
                  {formatDate(currentCycle.startDate)} - {formatDate(currentCycle.endDate)}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${currentCycle.status === 'open_manager_review'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800'
                    : currentCycle.status === 'closed'
                      ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-700'
                      : currentCycle.status === 'open_self_review'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800'
                  }`}>
                  {currentCycle.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {teamMembers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-gray-500 dark:text-[hsl(var(--muted-foreground))]">No team members found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                      <TableHead className="font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">Employee</TableHead>
                      <TableHead className="font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">Self Review</TableHead>
                      <TableHead className="font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">Review Status</TableHead>
                      <TableHead className="font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">Final Rating</TableHead>
                      <TableHead className="font-semibold text-right text-gray-900 dark:text-[hsl(var(--foreground))]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((employee) => {
                      const review = getReviewForEmployee(employee._id);
                      const hasSelf = hasSelfReview(employee._id);
                      const canEdit =
                        currentCycle.status === 'open_manager_review' &&
                        review?.status !== 'submitted';
                      const canView = currentCycle.status === 'closed' && review?.status === 'submitted';

                      return (
                        <TableRow
                          key={employee._id}
                          className="hover:bg-gray-50 dark:hover:bg-[hsl(var(--muted))] transition-colors border-gray-200 dark:border-[hsl(var(--border))]"
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                  {employee.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-[hsl(var(--foreground))]">
                                  {employee.name}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                                  {employee.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${hasSelf
                                  ? 'bg-green-200 text-green-900 dark:bg-green-900/30 dark:text-green-400 border border-green-300 dark:border-green-800'
                                  : 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border border-gray-300 dark:border-gray-700'
                                }`}
                              title={hasSelf ? 'Employee has submitted self-review' : 'Employee self-review not yet submitted (optional)'}
                            >
                              {hasSelf ? (
                                <CheckCircle className="h-3 w-3" />
                              ) : (
                                <AlertCircle className="h-3 w-3" />
                              )}
                              {hasSelf ? 'Submitted' : 'Pending'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {review ? (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${review.status === 'submitted'
                                    ? 'bg-green-200 text-green-900 dark:bg-green-900/30 dark:text-green-400 border border-green-300 dark:border-green-800'
                                    : 'bg-yellow-200 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-800'
                                  }`}
                              >
                                {review.status === 'submitted' ? (
                                  <CheckCircle className="h-3 w-3" />
                                ) : (
                                  <Clock className="h-3 w-3" />
                                )}
                                {review.status === 'submitted' ? 'Submitted' : 'Draft'}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                                Not started
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {review?.finalRating ? (
                              <div className="flex items-center gap-1.5">
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                <span className="font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                                  {review.finalRating}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-600">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {canEdit && (
                              <Button
                                size="sm"
                                onClick={() => handleStartReview(employee, currentCycle)}
                                className="gap-2"
                              >
                                <FileText className="h-4 w-4" />
                                {review ? 'Edit Review' : 'Start Review'}
                              </Button>
                            )}
                            {canView && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStartReview(employee, currentCycle)}
                                className="gap-2"
                              >
                                <TrendingUp className="h-4 w-4" />
                                View Review
                              </Button>
                            )}
                            {!canEdit && !canView && (
                              <span className="text-xs text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                                {currentCycle.status === 'closed'
                                  ? 'Cycle closed'
                                  : currentCycle.status !== 'open_manager_review'
                                    ? 'Not open'
                                    : 'Not available'}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-gray-900 dark:text-[hsl(var(--foreground))]">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              {selectedEmployee?.name} - Manager Review
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 mt-2 text-gray-600 dark:text-[hsl(var(--muted-foreground))]">
              <span className="font-medium">{selectedCycleData?.name}</span>
              {selectedCycleData?.status === 'closed' ? (
                <span className="text-xs">
                  (View only - Cycle closed)
                </span>
              ) : (
                <span className="text-xs">
                  Fill in the review below. You can save as draft and submit later.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedCycleData && (
            <form onSubmit={(e) => handleSubmit(e, false)}>
              <div className="space-y-4 py-4">
                {selectedCycleData.competencies.map((comp) => (
                  <div key={comp.name} className="space-y-2">
                    <Label htmlFor={comp.name} className="text-gray-900 dark:text-[hsl(var(--foreground))]">
                      {comp.name}
                      {comp.type === 'rating' && comp.maxRating && ` (1-${comp.maxRating})`}
                    </Label>
                    {comp.type === 'rating' ? (
                      <Input
                        id={comp.name}
                        type="number"
                        min="1"
                        max={comp.maxRating || 5}
                        value={formData.ratings[comp.name] || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            ratings: {
                              ...formData.ratings,
                              [comp.name]: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                        required
                        disabled={selectedCycleData.status === 'closed'}
                      />
                    ) : (
                      <Textarea
                        id={comp.name}
                        value={(formData.ratings[comp.name] as string) || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            ratings: {
                              ...formData.ratings,
                              [comp.name]: e.target.value,
                            },
                          })
                        }
                        required
                        disabled={selectedCycleData.status === 'closed'}
                        rows={3}
                      />
                    )}
                  </div>
                ))}
                <div className="space-y-2">
                  <Label htmlFor="managerComments" className="text-gray-900 dark:text-[hsl(var(--foreground))]">Manager Comments</Label>
                  <Textarea
                    id="managerComments"
                    value={formData.managerComments}
                    onChange={(e) => setFormData({ ...formData, managerComments: e.target.value })}
                    disabled={selectedCycleData.status === 'closed'}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finalRating" className="text-gray-900 dark:text-[hsl(var(--foreground))]">Final Rating *</Label>
                  <Input
                    id="finalRating"
                    value={formData.finalRating}
                    onChange={(e) => setFormData({ ...formData, finalRating: e.target.value })}
                    placeholder="e.g., Exceeds Expectations, Meets Expectations, Needs Improvement"
                    required
                    disabled={selectedCycleData.status === 'closed'}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                {selectedCycleData.status !== 'closed' && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={(e) => handleSubmit(e, false)}
                    >
                      Save Draft
                    </Button>
                    <Button type="button" onClick={(e) => handleSubmit(e, true)}>
                      Submit
                    </Button>
                  </>
                )}
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

