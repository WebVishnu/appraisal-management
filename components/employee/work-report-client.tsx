'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Send,
  Calendar,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { SkeletonCard } from '@/components/shared/skeleton-loader';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface WorkReportTask {
  title: string;
  category: 'development' | 'testing' | 'meeting' | 'support' | 'learning' | 'documentation' | 'other';
  description: string;
  timeSpent: number;
  status: 'completed' | 'in_progress' | 'blocked';
  blockerReason?: string;
}

interface WorkReport {
  _id: string;
  reportDate: string;
  frequency: 'daily' | 'weekly';
  status: 'draft' | 'submitted' | 'approved' | 'returned';
  tasks: WorkReportTask[];
  keyAchievements: string;
  challengesFaced: string;
  supportNeeded: string;
  selfProductivityRating: number;
  totalWorkHours: number;
  taskCompletionCount: number;
  blockedTasksCount: number;
  productivityScore?: number;
  attendanceMismatch?: {
    detected: boolean;
    reason: string;
  };
  managerReview?: {
    overallFeedback?: string;
    managerProductivityRating?: number;
    flag?: string;
    approved: boolean;
    returnedReason?: string;
  };
}

export default function WorkReportClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [tasks, setTasks] = useState<WorkReportTask[]>([
    {
      title: '',
      category: 'development',
      description: '',
      timeSpent: 0,
      status: 'completed',
    },
  ]);
  const [keyAchievements, setKeyAchievements] = useState('');
  const [challengesFaced, setChallengesFaced] = useState('');
  const [supportNeeded, setSupportNeeded] = useState('');
  const [selfProductivityRating, setSelfProductivityRating] = useState(3);
  const [existingReport, setExistingReport] = useState<WorkReport | null>(null);
  const [reportHistory, setReportHistory] = useState<WorkReport[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);

  useEffect(() => {
    fetchTodayReport();
    fetchReportHistory();
  }, [reportDate]);

  const fetchTodayReport = async () => {
    try {
      const response = await fetch(`/api/reports/work?startDate=${reportDate}&endDate=${reportDate}`);
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          const report = data[0];
          setExistingReport(report);
          setFrequency(report.frequency);
          setTasks(report.tasks || []);
          setKeyAchievements(report.keyAchievements || '');
          setChallengesFaced(report.challengesFaced || '');
          setSupportNeeded(report.supportNeeded || '');
          setSelfProductivityRating(report.selfProductivityRating || 3);
        } else {
          setExistingReport(null);
          // Reset form for new report
          setTasks([{ title: '', category: 'development', description: '', timeSpent: 0, status: 'completed' }]);
          setKeyAchievements('');
          setChallengesFaced('');
          setSupportNeeded('');
          setSelfProductivityRating(3);
        }
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReportHistory = async () => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const response = await fetch(
        `/api/reports/work?startDate=${startDate.toISOString().split('T')[0]}&endDate=${new Date().toISOString().split('T')[0]}`
      );
      if (response.ok) {
        const data = await response.json();
        setReportHistory(data.filter((r: WorkReport) => r.status === 'approved'));
      }
    } catch (error) {
      console.error('Error fetching report history:', error);
    }
  };

  const addTask = () => {
    setTasks([
      ...tasks,
      {
        title: '',
        category: 'development',
        description: '',
        timeSpent: 0,
        status: 'completed',
      },
    ]);
  };

  const removeTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const updateTask = (index: number, field: keyof WorkReportTask, value: any) => {
    const updatedTasks = [...tasks];
    updatedTasks[index] = { ...updatedTasks[index], [field]: value };
    setTasks(updatedTasks);
  };

  const calculateTotalHours = () => {
    return tasks.reduce((sum, task) => sum + task.timeSpent, 0) / 60;
  };

  const handleSave = async (submit: boolean = false) => {
    if (existingReport && existingReport.status === 'approved') {
      toast.error('Cannot modify approved report');
      return;
    }

    // Validation
    if (tasks.length === 0) {
      toast.error('Please add at least one task');
      return;
    }

    if (tasks.some(t => !t.title || !t.description || t.timeSpent <= 0)) {
      toast.error('Please fill in all task fields');
      return;
    }

    if (tasks.some(t => t.status === 'blocked' && !t.blockerReason)) {
      toast.error('Please provide blocker reason for blocked tasks');
      return;
    }

    if (!keyAchievements.trim()) {
      toast.error('Please provide key achievements');
      return;
    }

    if (!challengesFaced.trim()) {
      toast.error('Please describe challenges faced');
      return;
    }

    if (submit) {
      setSubmitting(true);
    } else {
      setSaving(true);
    }

    try {
      const url = existingReport ? `/api/reports/work/${existingReport._id}` : '/api/reports/work';
      const method = existingReport ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportDate,
          frequency,
          tasks,
          keyAchievements,
          challengesFaced,
          supportNeeded,
          selfProductivityRating,
          status: submit ? 'submitted' : 'draft',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(submit ? 'Report submitted successfully' : 'Report saved as draft');
        await fetchTodayReport();
        await fetchReportHistory();
      } else {
        toast.error(data.error || 'Failed to save report');
      }
    } catch (error) {
      toast.error('Failed to save report');
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };

  if (loading) {
    return <SkeletonCard />;
  }

  const totalHours = calculateTotalHours();
  const canEdit = !existingReport || existingReport.status === 'draft' || existingReport.status === 'returned';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Work Reports</h1>
          <p className="text-muted-foreground">Submit your daily or weekly work reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowHistory(true)}>
            <FileText className="mr-2 h-4 w-4" />
            View History
          </Button>
        </div>
      </div>

      {/* Attendance Mismatch Warning */}
      {existingReport?.attendanceMismatch?.detected && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p className="font-medium text-yellow-900 dark:text-yellow-100">Attendance Mismatch Detected</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {existingReport.attendanceMismatch.reason}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manager Review Feedback */}
      {existingReport?.managerReview && (
        <Card className={existingReport.managerReview.approved ? 'border-green-200 bg-green-50 dark:bg-green-900/20' : 'border-red-200 bg-red-50 dark:bg-red-900/20'}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-2">
              {existingReport.managerReview.approved ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {existingReport.managerReview.approved ? 'Report Approved' : 'Report Returned'}
                </p>
                {existingReport.managerReview.overallFeedback && (
                  <p className="text-sm mt-1">{existingReport.managerReview.overallFeedback}</p>
                )}
                {existingReport.managerReview.returnedReason && (
                  <p className="text-sm mt-1 text-red-600 dark:text-red-400">
                    Reason: {existingReport.managerReview.returnedReason}
                  </p>
                )}
                {existingReport.managerReview.managerProductivityRating && (
                  <p className="text-sm mt-1">
                    Manager Rating: {existingReport.managerReview.managerProductivityRating}/5
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Work Report</CardTitle>
              <CardDescription>
                {existingReport
                  ? `Report for ${formatDate(reportDate)} - ${existingReport.status.toUpperCase()}`
                  : `New report for ${formatDate(reportDate)}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total: {totalHours.toFixed(1)}h</span>
              </div>
              {existingReport?.productivityScore && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Score: {existingReport.productivityScore}/100</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Date and Frequency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reportDate">Report Date</Label>
              <Input
                id="reportDate"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={frequency} onValueChange={(v: 'daily' | 'weekly') => setFrequency(v)} disabled={!canEdit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tasks Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label>Tasks</Label>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={addTask}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Task
                </Button>
              )}
            </div>
            <div className="space-y-4">
              {tasks.map((task, index) => (
                <Card key={index} className="p-4">
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-4">
                      <Label>Task Title</Label>
                      <Input
                        value={task.title}
                        onChange={(e) => updateTask(index, 'title', e.target.value)}
                        placeholder="Enter task title"
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Label>Category</Label>
                      <Select
                        value={task.category}
                        onValueChange={(v: any) => updateTask(index, 'category', v)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="development">Development</SelectItem>
                          <SelectItem value="testing">Testing</SelectItem>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="support">Support</SelectItem>
                          <SelectItem value="learning">Learning</SelectItem>
                          <SelectItem value="documentation">Documentation</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Label>Time (minutes)</Label>
                      <Input
                        type="number"
                        value={task.timeSpent}
                        onChange={(e) => updateTask(index, 'timeSpent', parseInt(e.target.value) || 0)}
                        min="0"
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Label>Status</Label>
                      <Select
                        value={task.status}
                        onValueChange={(v: any) => updateTask(index, 'status', v)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {canEdit && (
                      <div className="col-span-6 md:col-span-2 flex items-end">
                        <Button variant="ghost" size="sm" onClick={() => removeTask(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="col-span-12">
                      <Label>Description</Label>
                      <Textarea
                        value={task.description}
                        onChange={(e) => updateTask(index, 'description', e.target.value)}
                        placeholder="Describe the task..."
                        disabled={!canEdit}
                        rows={2}
                      />
                    </div>
                    {task.status === 'blocked' && (
                      <div className="col-span-12">
                        <Label>Blocker Reason *</Label>
                        <Textarea
                          value={task.blockerReason || ''}
                          onChange={(e) => updateTask(index, 'blockerReason', e.target.value)}
                          placeholder="Explain why this task is blocked..."
                          disabled={!canEdit}
                          rows={2}
                        />
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Summary Section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="achievements">Key Achievements *</Label>
              <Textarea
                id="achievements"
                value={keyAchievements}
                onChange={(e) => setKeyAchievements(e.target.value)}
                placeholder="List your key achievements for the day..."
                disabled={!canEdit}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="challenges">Challenges Faced *</Label>
              <Textarea
                id="challenges"
                value={challengesFaced}
                onChange={(e) => setChallengesFaced(e.target.value)}
                placeholder="Describe challenges you encountered..."
                disabled={!canEdit}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="support">Support Needed</Label>
              <Textarea
                id="support"
                value={supportNeeded}
                onChange={(e) => setSupportNeeded(e.target.value)}
                placeholder="What support do you need from your manager?"
                disabled={!canEdit}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="rating">Self Productivity Rating (1-5) *</Label>
              <Select
                value={selfProductivityRating.toString()}
                onValueChange={(v) => setSelfProductivityRating(parseInt(v))}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Very Low</SelectItem>
                  <SelectItem value="2">2 - Low</SelectItem>
                  <SelectItem value="3">3 - Average</SelectItem>
                  <SelectItem value="4">4 - High</SelectItem>
                  <SelectItem value="5">5 - Very High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          {canEdit && (
            <div className="flex gap-2 pt-4">
              <Button onClick={() => handleSave(false)} disabled={saving || submitting}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving || submitting}>
                <Send className="mr-2 h-4 w-4" />
                {submitting ? 'Submitting...' : 'Submit Report'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report History</DialogTitle>
            <DialogDescription>View your past approved reports</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {reportHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No reports found</p>
            ) : (
              reportHistory.map((report) => (
                <Card
                  key={report._id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => setSelectedReport(report)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{formatDate(report.reportDate)}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.tasks.length} tasks • {report.totalWorkHours.toFixed(1)}h
                        </p>
                      </div>
                      <div className="text-right">
                        {report.productivityScore && (
                          <p className="font-medium">Score: {report.productivityScore}/100</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {report.taskCompletionCount}/{report.tasks.length} completed
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Detail Dialog */}
      {selectedReport && (
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Report Details - {formatDate(selectedReport.reportDate)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="font-medium">{selectedReport.totalWorkHours.toFixed(1)}h</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tasks Completed</p>
                  <p className="font-medium">
                    {selectedReport.taskCompletionCount}/{selectedReport.tasks.length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Productivity Score</p>
                  <p className="font-medium">{selectedReport.productivityScore || 'N/A'}/100</p>
                </div>
              </div>
              <div>
                <p className="font-medium mb-2">Tasks</p>
                <div className="space-y-2">
                  {selectedReport.tasks.map((task, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{task.title}</p>
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                          <div className="flex gap-4 mt-2 text-xs">
                            <span>{task.category}</span>
                            <span>{task.timeSpent} min</span>
                            <span className="capitalize">{task.status.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium mb-2">Key Achievements</p>
                <p className="text-sm">{selectedReport.keyAchievements}</p>
              </div>
              <div>
                <p className="font-medium mb-2">Challenges</p>
                <p className="text-sm">{selectedReport.challengesFaced}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

