'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatErrorMessage } from '@/lib/utils/format';
import { X, Plus } from 'lucide-react';

interface FeedbackFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string;
  candidateName: string;
  roundName: string;
  onSuccess: () => void;
}

export default function FeedbackFormDialog({
  open,
  onOpenChange,
  interviewId,
  candidateName,
  roundName,
  onSuccess,
}: FeedbackFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    technicalSkillsRating: 3 as 1 | 2 | 3 | 4 | 5,
    technicalSkillsComments: '',
    problemSolvingRating: 3 as 1 | 2 | 3 | 4 | 5,
    problemSolvingComments: '',
    communicationRating: 3 as 1 | 2 | 3 | 4 | 5,
    communicationComments: '',
    cultureFitRating: 3 as 1 | 2 | 3 | 4 | 5,
    cultureFitComments: '',
    overallRecommendation: 'hold' as 'strong_yes' | 'yes' | 'hold' | 'no',
    overallComments: '',
    strengths: [] as string[],
    weaknesses: [] as string[],
    recommendation: 'maybe' as 'hire' | 'maybe' | 'reject',
    confidenceLevel: 'medium' as 'high' | 'medium' | 'low',
    interviewerNotes: '',
  });

  const [newStrength, setNewStrength] = useState('');
  const [newWeakness, setNewWeakness] = useState('');

  const handleSubmit = async () => {
    try {
      if (!formData.overallComments.trim()) {
        toast.error('Please provide overall comments');
        return;
      }

      setLoading(true);

      // First update interview status to completed
      const statusResponse = await fetch('/api/interviews/interviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: interviewId,
          status: 'completed',
        }),
      });

      if (!statusResponse.ok) {
        const statusData = await statusResponse.json();
        toast.error(formatErrorMessage(statusData.error, 'Failed to update interview status'));
        setLoading(false);
        return;
      }

      // Then submit feedback
      const response = await fetch('/api/interviews/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId,
          ...formData,
          isSubmitted: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Feedback submitted successfully and interview marked as completed');
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(formatErrorMessage(data.error, 'Failed to submit feedback'));
      }
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      toast.error(formatErrorMessage(error, 'Failed to submit feedback'));
    } finally {
      setLoading(false);
    }
  };

  const addStrength = () => {
    if (newStrength.trim()) {
      setFormData({
        ...formData,
        strengths: [...formData.strengths, newStrength.trim()],
      });
      setNewStrength('');
    }
  };

  const removeStrength = (index: number) => {
    setFormData({
      ...formData,
      strengths: formData.strengths.filter((_, i) => i !== index),
    });
  };

  const addWeakness = () => {
    if (newWeakness.trim()) {
      setFormData({
        ...formData,
        weaknesses: [...formData.weaknesses, newWeakness.trim()],
      });
      setNewWeakness('');
    }
  };

  const removeWeakness = (index: number) => {
    setFormData({
      ...formData,
      weaknesses: formData.weaknesses.filter((_, i) => i !== index),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Interview Feedback</DialogTitle>
          <DialogDescription>
            Provide feedback for {candidateName} - {roundName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Technical Skills */}
          <div>
            <Label>Technical Skills Rating *</Label>
            <div className="flex items-center gap-4">
              <Select
                value={formData.technicalSkillsRating.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, technicalSkillsRating: parseInt(value) as 1 | 2 | 3 | 4 | 5 })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Poor</SelectItem>
                  <SelectItem value="2">2 - Below Average</SelectItem>
                  <SelectItem value="3">3 - Average</SelectItem>
                  <SelectItem value="4">4 - Good</SelectItem>
                  <SelectItem value="5">5 - Excellent</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Comments on technical skills..."
                value={formData.technicalSkillsComments}
                onChange={(e) =>
                  setFormData({ ...formData, technicalSkillsComments: e.target.value })
                }
                rows={2}
                className="flex-1"
              />
            </div>
          </div>

          {/* Problem Solving */}
          <div>
            <Label>Problem Solving Rating *</Label>
            <div className="flex items-center gap-4">
              <Select
                value={formData.problemSolvingRating.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, problemSolvingRating: parseInt(value) as 1 | 2 | 3 | 4 | 5 })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Poor</SelectItem>
                  <SelectItem value="2">2 - Below Average</SelectItem>
                  <SelectItem value="3">3 - Average</SelectItem>
                  <SelectItem value="4">4 - Good</SelectItem>
                  <SelectItem value="5">5 - Excellent</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Comments on problem solving..."
                value={formData.problemSolvingComments}
                onChange={(e) =>
                  setFormData({ ...formData, problemSolvingComments: e.target.value })
                }
                rows={2}
                className="flex-1"
              />
            </div>
          </div>

          {/* Communication */}
          <div>
            <Label>Communication Rating *</Label>
            <div className="flex items-center gap-4">
              <Select
                value={formData.communicationRating.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, communicationRating: parseInt(value) as 1 | 2 | 3 | 4 | 5 })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Poor</SelectItem>
                  <SelectItem value="2">2 - Below Average</SelectItem>
                  <SelectItem value="3">3 - Average</SelectItem>
                  <SelectItem value="4">4 - Good</SelectItem>
                  <SelectItem value="5">5 - Excellent</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Comments on communication..."
                value={formData.communicationComments}
                onChange={(e) =>
                  setFormData({ ...formData, communicationComments: e.target.value })
                }
                rows={2}
                className="flex-1"
              />
            </div>
          </div>

          {/* Culture Fit */}
          <div>
            <Label>Culture Fit Rating *</Label>
            <div className="flex items-center gap-4">
              <Select
                value={formData.cultureFitRating.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, cultureFitRating: parseInt(value) as 1 | 2 | 3 | 4 | 5 })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Poor</SelectItem>
                  <SelectItem value="2">2 - Below Average</SelectItem>
                  <SelectItem value="3">3 - Average</SelectItem>
                  <SelectItem value="4">4 - Good</SelectItem>
                  <SelectItem value="5">5 - Excellent</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Comments on culture fit..."
                value={formData.cultureFitComments}
                onChange={(e) =>
                  setFormData({ ...formData, cultureFitComments: e.target.value })
                }
                rows={2}
                className="flex-1"
              />
            </div>
          </div>

          {/* Overall Recommendation */}
          <div>
            <Label>Overall Recommendation *</Label>
            <Select
              value={formData.overallRecommendation}
              onValueChange={(value: any) =>
                setFormData({ ...formData, overallRecommendation: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strong_yes">Strong Yes</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="hold">Hold</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Overall Comments */}
          <div>
            <Label>Overall Comments *</Label>
            <Textarea
              placeholder="Provide detailed overall feedback..."
              value={formData.overallComments}
              onChange={(e) => setFormData({ ...formData, overallComments: e.target.value })}
              rows={4}
              required
            />
          </div>

          {/* Strengths */}
          <div>
            <Label>Strengths</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newStrength}
                onChange={(e) => setNewStrength(e.target.value)}
                placeholder="Add a strength..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addStrength();
                  }
                }}
              />
              <Button type="button" onClick={addStrength} size="sm" variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.strengths.map((strength, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-sm"
                >
                  <span>{strength}</span>
                  <button
                    type="button"
                    onClick={() => removeStrength(index)}
                    className="ml-1 hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Weaknesses */}
          <div>
            <Label>Weaknesses / Areas for Improvement</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newWeakness}
                onChange={(e) => setNewWeakness(e.target.value)}
                placeholder="Add a weakness..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addWeakness();
                  }
                }}
              />
              <Button type="button" onClick={addWeakness} size="sm" variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.weaknesses.map((weakness, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded text-sm"
                >
                  <span>{weakness}</span>
                  <button
                    type="button"
                    onClick={() => removeWeakness(index)}
                    className="ml-1 hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <div>
            <Label>Hiring Recommendation *</Label>
            <Select
              value={formData.recommendation}
              onValueChange={(value: any) =>
                setFormData({ ...formData, recommendation: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hire">Hire</SelectItem>
                <SelectItem value="maybe">Maybe</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Confidence Level */}
          <div>
            <Label>Confidence Level</Label>
            <Select
              value={formData.confidenceLevel}
              onValueChange={(value: any) =>
                setFormData({ ...formData, confidenceLevel: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Interviewer Notes */}
          <div>
            <Label>Private Notes (HR/Manager only)</Label>
            <Textarea
              placeholder="Private notes that only HR and managers can see..."
              value={formData.interviewerNotes}
              onChange={(e) => setFormData({ ...formData, interviewerNotes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.overallComments.trim()}>
            {loading ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

