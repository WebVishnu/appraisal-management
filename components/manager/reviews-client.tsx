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
  cycleId: string;
  employeeId: string;
  status: 'draft' | 'submitted';
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
      // We need to check which employees have submitted self reviews
      // This is a simplified approach - in production, you might want a dedicated endpoint
      const response = await fetch(`/api/reviews/self?cycleId=${selectedCycle}`);
      if (response.ok) {
        const data = await response.json();
        setSelfReviews(data);
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
      (r) =>
        ((r.employeeId as any)._id === employeeId || (r.employeeId as any).toString() === employeeId) &&
        r.status === 'submitted'
    );
  };

  const currentCycle = cycles.find((c) => c._id === selectedCycle);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Label htmlFor="cycle-select" className="mb-2 block">
          Select Appraisal Cycle
        </Label>
        <Select value={selectedCycle} onValueChange={setSelectedCycle}>
          <SelectTrigger id="cycle-select" className="w-full max-w-md">
            <SelectValue placeholder="Select a cycle" />
          </SelectTrigger>
          <SelectContent>
            {cycles.map((cycle) => (
              <SelectItem key={cycle._id} value={cycle._id}>
                {cycle.name} ({cycle.status.replace('_', ' ')})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCycle && currentCycle && (
        <Card>
          <CardHeader>
            <CardTitle>{currentCycle.name} - Team Reviews</CardTitle>
            <CardDescription>
              {new Date(currentCycle.startDate).toLocaleDateString()} -{' '}
              {new Date(currentCycle.endDate).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teamMembers.length === 0 ? (
              <p className="text-center text-gray-500">No team members found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Self Review</TableHead>
                    <TableHead>Review Status</TableHead>
                    <TableHead>Final Rating</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((employee) => {
                    const review = getReviewForEmployee(employee._id);
                    const hasSelf = hasSelfReview(employee._id);
                    // Managers can now edit/create reviews regardless of self-review status
                    const canEdit =
                      currentCycle.status === 'open_manager_review' &&
                      review?.status !== 'submitted';
                    const canView = currentCycle.status === 'closed' && review?.status === 'submitted';

                    return (
                      <TableRow key={employee._id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{employee.name}</div>
                            <div className="text-sm text-gray-500">{employee.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              hasSelf ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                            }`}
                            title={hasSelf ? 'Employee has submitted self-review' : 'Employee self-review not yet submitted (optional)'}
                          >
                            {hasSelf ? 'Submitted' : 'Not submitted'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {review ? (
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                review.status === 'submitted'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {review.status === 'submitted' ? 'Submitted' : 'Draft'}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500">Not started</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {review?.finalRating || '-'}
                        </TableCell>
                        <TableCell>
                          {canEdit && (
                            <Button
                              size="sm"
                              onClick={() => handleStartReview(employee, currentCycle)}
                            >
                              {review ? 'Edit Review' : 'Start Review'}
                            </Button>
                          )}
                          {canView && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStartReview(employee, currentCycle)}
                            >
                              View Review
                            </Button>
                          )}
                          {!canEdit && !canView && (
                            <span className="text-sm text-gray-500">
                              {currentCycle.status === 'closed'
                                ? 'Cycle closed'
                                : currentCycle.status !== 'open_manager_review'
                                ? 'Cycle not open for manager review'
                                : 'Not available'}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>
              {selectedEmployee?.name} - Manager Review ({selectedCycleData?.name})
            </DialogTitle>
            <DialogDescription>
              {selectedCycleData?.status === 'closed'
                ? 'View your submitted review'
                : 'Fill in the manager review below. You can save as draft and submit later.'}
            </DialogDescription>
          </DialogHeader>
          {selectedCycleData && (
            <form onSubmit={(e) => handleSubmit(e, false)}>
              <div className="space-y-4 py-4">
                {selectedCycleData.competencies.map((comp) => (
                  <div key={comp.name} className="space-y-2">
                    <Label htmlFor={comp.name}>
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
                  <Label htmlFor="managerComments">Manager Comments</Label>
                  <Textarea
                    id="managerComments"
                    value={formData.managerComments}
                    onChange={(e) => setFormData({ ...formData, managerComments: e.target.value })}
                    disabled={selectedCycleData.status === 'closed'}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finalRating">Final Rating *</Label>
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

