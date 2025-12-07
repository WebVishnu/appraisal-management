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

interface SelfReview {
  _id: string;
  cycleId: Cycle;
  ratings: Record<string, number | string>;
  comments: string;
  status: 'draft' | 'submitted';
  submittedAt?: string;
}

export default function EmployeeAppraisalsClient() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [reviews, setReviews] = useState<SelfReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [formData, setFormData] = useState<{
    ratings: Record<string, number | string>;
    comments: string;
  }>({
    ratings: {},
    comments: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch active cycles for employees (this endpoint is accessible to employees)
      const cyclesResponse = await fetch('/api/cycles/active');
      if (cyclesResponse.ok) {
        const cyclesData = await cyclesResponse.json();
        setCycles(cyclesData);
      } else {
        console.error('Failed to fetch cycles:', cyclesResponse.status);
        toast.error('Failed to fetch appraisal cycles');
      }

      // Fetch self reviews
      const reviewsResponse = await fetch('/api/reviews/self');
      if (reviewsResponse.ok) {
        const reviewsData = await reviewsResponse.json();
        setReviews(reviewsData);
      } else {
        console.error('Failed to fetch reviews:', reviewsResponse.status);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  const handleStartReview = (cycle: Cycle) => {
    // Check if review already exists
    const existingReview = reviews.find(
      (r) => (r.cycleId as any)._id === cycle._id || (r.cycleId as any).toString() === cycle._id
    );

    if (existingReview && existingReview.status === 'submitted') {
      toast.error('This review has already been submitted');
      return;
    }

    setSelectedCycle(cycle);
    if (existingReview) {
      setFormData({
        ratings: existingReview.ratings || {},
        comments: existingReview.comments || '',
      });
    } else {
      const initialRatings: Record<string, number | string> = {};
      cycle.competencies.forEach((comp) => {
        initialRatings[comp.name] = comp.type === 'rating' ? 0 : '';
      });
      setFormData({
        ratings: initialRatings,
        comments: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent, submit: boolean = false) => {
    e.preventDefault();

    if (!selectedCycle) return;

    // Validate ratings
    for (const comp of selectedCycle.competencies) {
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
      const response = await fetch('/api/reviews/self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId: selectedCycle._id,
          ratings: formData.ratings,
          comments: formData.comments,
          status: submit ? 'submitted' : 'draft',
        }),
      });

      if (response.ok) {
        toast.success(submit ? 'Review submitted successfully' : 'Review saved as draft');
        setIsDialogOpen(false);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save review');
      }
    } catch (error) {
      toast.error('Error saving review');
    }
  };

  const getReviewForCycle = (cycleId: string) => {
    return reviews.find(
      (r) => (r.cycleId as any)._id === cycleId || (r.cycleId as any).toString() === cycleId
    );
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  // Filter cycles that are open for self review or closed (to view results)
  const availableCycles = cycles.filter(
    (c) => c.status === 'open_self_review' || c.status === 'closed'
  );

  return (
    <div>
      {cycles.length > 0 && availableCycles.length === 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> There are {cycles.length} cycle(s) available, but none are currently open for self-review. 
            Please wait for HR to open the cycle for self-review, or check back later.
          </p>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {availableCycles.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <p className="text-gray-500 text-lg mb-2">No appraisal cycles available</p>
                <p className="text-sm text-gray-400">
                  {cycles.length === 0 
                    ? 'No cycles have been created yet. Please contact HR for more information.'
                    : 'No cycles are currently open for self-review. Please check back later or contact HR.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          availableCycles.map((cycle) => {
            const review = getReviewForCycle(cycle._id);
            const canEdit = cycle.status === 'open_self_review' && review?.status !== 'submitted';
            const canView = cycle.status === 'closed' && review?.status === 'submitted';

            return (
              <Card key={cycle._id}>
                <CardHeader>
                  <CardTitle>{cycle.name}</CardTitle>
                  <CardDescription>
                    {new Date(cycle.startDate).toLocaleDateString()} -{' '}
                    {new Date(cycle.endDate).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-600">Status: </span>
                      <span className="text-sm font-medium capitalize">
                        {cycle.status.replace('_', ' ')}
                      </span>
                    </div>
                    {review && (
                      <div>
                        <span className="text-sm text-gray-600">Review Status: </span>
                        <span
                          className={`text-sm font-medium ${
                            review.status === 'submitted' ? 'text-green-600' : 'text-yellow-600'
                          }`}
                        >
                          {review.status === 'submitted' ? 'Submitted' : 'Draft'}
                        </span>
                      </div>
                    )}
                    {canEdit && (
                      <Button
                        className="w-full mt-4"
                        onClick={() => handleStartReview(cycle)}
                      >
                        {review ? 'Edit Review' : 'Start Review'}
                      </Button>
                    )}
                    {canView && (
                      <Button
                        variant="outline"
                        className="w-full mt-4"
                        onClick={() => handleStartReview(cycle)}
                      >
                        View Review
                      </Button>
                    )}
                    {!canEdit && !canView && (
                      <p className="text-sm text-gray-500 mt-4">
                        {cycle.status === 'closed'
                          ? 'Review not submitted'
                          : 'Waiting for cycle to open'}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>
              {selectedCycle?.name} - Self Assessment
            </DialogTitle>
            <DialogDescription>
              {selectedCycle?.status === 'closed'
                ? 'View your submitted review'
                : 'Fill in your self-assessment below. You can save as draft and submit later.'}
            </DialogDescription>
          </DialogHeader>
          {selectedCycle && (
            <form onSubmit={(e) => handleSubmit(e, false)}>
              <div className="space-y-4 py-4">
                {selectedCycle.competencies.map((comp) => (
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
                        disabled={selectedCycle.status === 'closed'}
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
                        disabled={selectedCycle.status === 'closed'}
                        rows={3}
                      />
                    )}
                  </div>
                ))}
                <div className="space-y-2">
                  <Label htmlFor="comments">Additional Comments</Label>
                  <Textarea
                    id="comments"
                    value={formData.comments}
                    onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                    disabled={selectedCycle.status === 'closed'}
                    rows={4}
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
                {selectedCycle.status !== 'closed' && (
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

