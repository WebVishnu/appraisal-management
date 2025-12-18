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
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Calendar,
  Search,
} from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { SkeletonCard } from '@/components/shared/skeleton-loader';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface WorkReportTask {
  title: string;
  category: string;
  description: string;
  timeSpent: number;
  status: 'completed' | 'in_progress' | 'blocked';
  blockerReason?: string;
}

interface WorkReport {
  _id: string;
  employeeId: {
    _id: string;
    name: string;
    employeeId: string;
  };
  reportDate: string;
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
  managerReview?: {
    taskComments?: Array<{ taskIndex: number; comment: string }>;
    overallFeedback?: string;
    managerProductivityRating?: number;
    flag?: string;
    approved: boolean;
    returnedReason?: string;
  };
}

interface TeamOverview {
  employeeId: string;
  employeeName: string;
  totalReports: number;
  averageProductivityScore: number;
  totalWorkHours: number;
  averageWorkHours: number;
  taskCompletionRate: number;
  blockedTasksCount: number;
  flags: string[];
}

export default function ManagerWorkReportClient() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'overview' | 'reports'>('overview');
  const [teamOverview, setTeamOverview] = useState<TeamOverview[]>([]);
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [searchTerm, setSearchTerm] = useState('');

  // Review form state
  const [taskComments, setTaskComments] = useState<Record<number, string>>({});
  const [overallFeedback, setOverallFeedback] = useState('');
  const [managerProductivityRating, setManagerProductivityRating] = useState(3);
  const [flag, setFlag] = useState<string>('');
  const [approved, setApproved] = useState(true);
  const [returnedReason, setReturnedReason] = useState('');

  useEffect(() => {
    if (view === 'overview') {
      fetchTeamOverview();
    } else {
      fetchReports();
    }
  }, [view, startDate, endDate, statusFilter]);

  const fetchTeamOverview = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/reports/work?startDate=${startDate}&endDate=${endDate}&status=approved`
      );
      if (response.ok) {
        const data = await response.json();
        
        // Group by employee
        const employeeMap = new Map<string, TeamOverview>();
        
        data.forEach((report: WorkReport) => {
          const empId = report.employeeId._id;
          if (!employeeMap.has(empId)) {
            employeeMap.set(empId, {
              employeeId: empId,
              employeeName: report.employeeId.name,
              totalReports: 0,
              averageProductivityScore: 0,
              totalWorkHours: 0,
              averageWorkHours: 0,
              taskCompletionRate: 0,
              blockedTasksCount: 0,
              flags: [],
            });
          }
          
          const overview = employeeMap.get(empId)!;
          overview.totalReports++;
          overview.totalWorkHours += report.totalWorkHours;
          overview.blockedTasksCount += report.blockedTasksCount;
          if (report.productivityScore) {
            overview.averageProductivityScore += report.productivityScore;
          }
          if (report.managerReview?.flag) {
            overview.flags.push(report.managerReview.flag);
          }
        });
        
        // Calculate averages
        const overviewArray = Array.from(employeeMap.values()).map(overview => ({
          ...overview,
          averageProductivityScore: overview.averageProductivityScore / overview.totalReports,
          averageWorkHours: overview.totalWorkHours / overview.totalReports,
          flags: [...new Set(overview.flags)],
        }));
        
        setTeamOverview(overviewArray);
      }
    } catch (error) {
      console.error('Error fetching team overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/reports/work?startDate=${startDate}&endDate=${endDate}&status=${statusFilter}`
      );
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (report: WorkReport) => {
    setSelectedReport(report);
    setTaskComments({});
    setOverallFeedback(report.managerReview?.overallFeedback || '');
    setManagerProductivityRating(report.managerReview?.managerProductivityRating || 3);
    setFlag(report.managerReview?.flag || '');
    setApproved(report.managerReview?.approved ?? true);
    setReturnedReason(report.managerReview?.returnedReason || '');
    setReviewDialogOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedReport) return;

    if (!approved && !returnedReason.trim()) {
      toast.error('Please provide a reason for returning the report');
      return;
    }

    setReviewing(true);
    try {
      const response = await fetch(`/api/reports/work/${selectedReport._id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskComments: Object.entries(taskComments).map(([index, comment]) => ({
            taskIndex: parseInt(index),
            comment,
          })),
          overallFeedback,
          managerProductivityRating,
          flag: flag || null,
          approved,
          returnedReason: approved ? null : returnedReason,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(approved ? 'Report approved successfully' : 'Report returned for revision');
        setReviewDialogOpen(false);
        await fetchReports();
        await fetchTeamOverview();
      } else {
        toast.error(data.error || 'Failed to submit review');
      }
    } catch (error) {
      toast.error('Failed to submit review');
    } finally {
      setReviewing(false);
    }
  };

  const filteredReports = reports.filter((report) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      report.employeeId.name.toLowerCase().includes(search) ||
      report.employeeId.employeeId.toLowerCase().includes(search)
    );
  });

  if (loading && view === 'overview') {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Work Reports</h1>
          <p className="text-muted-foreground">Review and manage your team's work reports</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === 'overview' ? 'default' : 'outline'}
            onClick={() => setView('overview')}
          >
            <Users className="mr-2 h-4 w-4" />
            Team Overview
          </Button>
          <Button
            variant={view === 'reports' ? 'default' : 'outline'}
            onClick={() => setView('reports')}
          >
            <FileText className="mr-2 h-4 w-4" />
            Pending Reviews
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {view === 'reports' && (
              <div>
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {view === 'overview' ? (
        /* Team Overview */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teamOverview.map((member) => (
            <Card key={member.employeeId}>
              <CardHeader>
                <CardTitle className="text-lg">{member.employeeName}</CardTitle>
                <CardDescription>{member.totalReports} reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Productivity</span>
                  <span className="font-medium">{member.averageProductivityScore.toFixed(1)}/100</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Work Hours</span>
                  <span className="font-medium">{member.averageWorkHours.toFixed(1)}h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Task Completion</span>
                  <span className="font-medium">{member.taskCompletionRate.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Blocked Tasks</span>
                  <span className="font-medium">{member.blockedTasksCount}</span>
                </div>
                {member.flags.length > 0 && (
                  <div className="pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Flags: </span>
                    <span className="text-xs font-medium">{member.flags.join(', ')}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {teamOverview.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="pt-6 text-center text-muted-foreground">
                No reports found for the selected period
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Reports List */
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredReports.map((report) => (
            <Card key={report._id} className="cursor-pointer hover:bg-accent" onClick={() => handleReview(report)}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">{report.employeeId.name}</h3>
                      <span className="text-sm text-muted-foreground">({report.employeeId.employeeId})</span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        report.status === 'approved' ? 'bg-green-100 text-green-800' :
                        report.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                        report.status === 'returned' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {report.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{formatDate(report.reportDate)}</p>
                    <div className="flex gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {report.totalWorkHours.toFixed(1)}h
                      </span>
                      <span>{report.tasks.length} tasks</span>
                      <span>{report.taskCompletionCount} completed</span>
                      {report.blockedTasksCount > 0 && (
                        <span className="text-red-600">{report.blockedTasksCount} blocked</span>
                      )}
                      {report.productivityScore && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          {report.productivityScore}/100
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredReports.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No reports found
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Review Report - {selectedReport?.employeeId.name} ({formatDate(selectedReport?.reportDate || '')})
            </DialogTitle>
            <DialogDescription>Provide feedback and approve or return the report</DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-6">
              {/* Report Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="font-medium">{selectedReport.totalWorkHours.toFixed(1)}h</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tasks</p>
                  <p className="font-medium">
                    {selectedReport.taskCompletionCount}/{selectedReport.tasks.length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Blocked</p>
                  <p className="font-medium">{selectedReport.blockedTasksCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Self Rating</p>
                  <p className="font-medium">{selectedReport.selfProductivityRating}/5</p>
                </div>
              </div>

              {/* Tasks */}
              <div>
                <Label className="mb-2 block">Tasks</Label>
                <div className="space-y-2">
                  {selectedReport.tasks.map((task, index) => (
                    <Card key={index} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{task.title}</p>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{task.category}</span>
                            <span className="text-xs text-muted-foreground">{task.timeSpent} min</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              task.status === 'completed' ? 'bg-green-100 text-green-800' :
                              task.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                          {task.status === 'blocked' && task.blockerReason && (
                            <p className="text-sm text-red-600 mt-1">Blocker: {task.blockerReason}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <Textarea
                          placeholder="Add comment for this task..."
                          value={taskComments[index] || ''}
                          onChange={(e) => setTaskComments({ ...taskComments, [index]: e.target.value })}
                          rows={2}
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Summary Sections */}
              <div>
                <Label className="mb-2 block">Key Achievements</Label>
                <p className="text-sm bg-gray-50 p-3 rounded">{selectedReport.keyAchievements}</p>
              </div>
              <div>
                <Label className="mb-2 block">Challenges Faced</Label>
                <p className="text-sm bg-gray-50 p-3 rounded">{selectedReport.challengesFaced}</p>
              </div>
              {selectedReport.supportNeeded && (
                <div>
                  <Label className="mb-2 block">Support Needed</Label>
                  <p className="text-sm bg-gray-50 p-3 rounded">{selectedReport.supportNeeded}</p>
                </div>
              )}

              {/* Review Form */}
              <div className="space-y-4 border-t pt-4">
                <div>
                  <Label htmlFor="feedback">Overall Feedback</Label>
                  <Textarea
                    id="feedback"
                    value={overallFeedback}
                    onChange={(e) => setOverallFeedback(e.target.value)}
                    placeholder="Provide overall feedback..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="rating">Productivity Rating (1-5)</Label>
                    <Select
                      value={managerProductivityRating.toString()}
                      onValueChange={(v) => setManagerProductivityRating(parseInt(v))}
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
                  <div>
                    <Label htmlFor="flag">Flag Employee</Label>
                    <Select value={flag} onValueChange={setFlag}>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="overloaded">Overloaded</SelectItem>
                        <SelectItem value="needs_support">Needs Support</SelectItem>
                        <SelectItem value="under_utilized">Under-utilized</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <Label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={approved}
                        onChange={() => setApproved(true)}
                        className="w-4 h-4"
                      />
                      Approve
                    </Label>
                    <Label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={!approved}
                        onChange={() => setApproved(false)}
                        className="w-4 h-4"
                      />
                      Return for Revision
                    </Label>
                  </div>
                  {!approved && (
                    <div>
                      <Label htmlFor="returnReason">Return Reason *</Label>
                      <Textarea
                        id="returnReason"
                        value={returnedReason}
                        onChange={(e) => setReturnedReason(e.target.value)}
                        placeholder="Explain why the report is being returned..."
                        rows={2}
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSubmitReview} disabled={reviewing}>
                    {reviewing ? 'Submitting...' : approved ? 'Approve Report' : 'Return Report'}
                  </Button>
                  <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

