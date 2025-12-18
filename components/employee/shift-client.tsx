'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Calendar, Clock, Briefcase, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { SkeletonCard } from '@/components/shared/skeleton-loader';

interface Shift {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  gracePeriod: number;
  minimumWorkingHours: number;
  breakDuration: number;
  isNightShift: boolean;
}

interface RosterEntry {
  _id: string;
  shiftId: Shift;
  date: string;
  isWeeklyOff: boolean;
}

interface ShiftAssignment {
  _id: string;
  shiftId: Shift;
  assignmentType: 'permanent' | 'temporary';
  assignmentScope: 'employee' | 'team' | 'department';
  startDate?: string;
  endDate?: string;
  effectiveDate: string;
  isActive: boolean;
}

interface ShiftSwap {
  _id: string;
  requesteeId: {
    _id: string;
    name: string;
  };
  requesterDate: string;
  requesteeDate: string;
  requesterShiftId: {
    name: string;
  };
  requesteeShiftId: {
    name: string;
  };
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
}

interface Employee {
  _id: string;
  name: string;
  employeeId: string;
  isActive: boolean;
}

export default function EmployeeShiftClient() {
  const [loading, setLoading] = useState(true);
  const [todayShift, setTodayShift] = useState<Shift | null>(null);
  const [upcomingRoster, setUpcomingRoster] = useState<RosterEntry[]>([]);
  const [permanentAssignment, setPermanentAssignment] = useState<ShiftAssignment | null>(null);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [swapFormData, setSwapFormData] = useState({
    requesteeId: '',
    requesterDate: '',
    requesteeDate: '',
    reason: '',
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mySwapRequests, setMySwapRequests] = useState<ShiftSwap[]>([]);

  useEffect(() => {
    fetchShiftData();
    fetchEmployees();
    fetchMySwapRequests();
  }, []);

  const fetchShiftData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Fetch today's roster
      const rosterResponse = await fetch(`/api/shifts/roster?startDate=${today}&endDate=${today}`);
      if (rosterResponse.ok) {
        const rosterData = await rosterResponse.json();
        if (rosterData.length > 0 && !rosterData[0].isWeeklyOff) {
          setTodayShift(rosterData[0].shiftId);
        }
      }

      // Fetch upcoming roster
      const upcomingResponse = await fetch(
        `/api/shifts/roster?startDate=${today}&endDate=${nextWeek}`
      );
      if (upcomingResponse.ok) {
        const upcomingData = await rosterResponse.json();
        setUpcomingRoster(upcomingData.filter((e: RosterEntry) => e.date !== today));
      }

      // Fetch permanent assignment
      const assignmentResponse = await fetch('/api/shifts/assignments?assignmentType=permanent');
      if (assignmentResponse.ok) {
        const assignments = await assignmentResponse.json();
        const myAssignment = assignments.find(
          (a: ShiftAssignment) => a.assignmentScope === 'employee' && a.isActive
        );
        if (myAssignment) {
          setPermanentAssignment(myAssignment);
          if (!todayShift) {
            setTodayShift(myAssignment.shiftId);
          }
        }
      }
    } catch (error) {
      toast.error('Failed to fetch shift data');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.filter((e: Employee) => e.isActive));
      }
    } catch (error) {
      toast.error('Failed to fetch employees');
    }
  };

  const fetchMySwapRequests = async () => {
    try {
      const response = await fetch('/api/shifts/swaps');
      if (response.ok) {
        const data = await response.json();
        setMySwapRequests(data.filter((s: ShiftSwap) => s.status === 'pending'));
      }
    } catch (error) {
      toast.error('Failed to fetch swap requests');
    }
  };

  const handleCreateSwap = async () => {
    try {
      const response = await fetch('/api/shifts/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(swapFormData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Swap request created successfully');
        setSwapDialogOpen(false);
        setSwapFormData({
          requesteeId: '',
          requesterDate: '',
          requesteeDate: '',
          reason: '',
        });
        fetchMySwapRequests();
      } else {
        toast.error(data.error || 'Failed to create swap request');
      }
    } catch (error) {
      toast.error('Failed to create swap request');
    }
  };

  const handleCancelSwap = async (swapId: string) => {
    try {
      const response = await fetch(`/api/shifts/swaps/${swapId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (response.ok) {
        toast.success('Swap request cancelled');
        fetchMySwapRequests();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to cancel swap');
      }
    } catch (error) {
      toast.error('Failed to cancel swap');
    }
  };

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Shifts</h1>
          <p className="text-muted-foreground">View your shift schedule and request swaps</p>
        </div>
        <Button onClick={() => setSwapDialogOpen(true)}>
          <Briefcase className="h-4 w-4 mr-2" />
          Request Shift Swap
        </Button>
      </div>

      {/* Today's Shift */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today's Shift
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayShift ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">{todayShift.name}</h3>
                {todayShift.isNightShift && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Night Shift</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium">{todayShift.startTime} - {todayShift.endTime}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Grace Period</p>
                  <p className="font-medium">{todayShift.gracePeriod} minutes</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Minimum Hours</p>
                  <p className="font-medium">{todayShift.minimumWorkingHours / 60} hours</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Break</p>
                  <p className="font-medium">{todayShift.breakDuration} minutes</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No shift assigned for today</p>
          )}
        </CardContent>
      </Card>

      {/* Permanent Assignment */}
      {permanentAssignment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Permanent Shift Assignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h3 className="font-medium">{permanentAssignment.shiftId.name}</h3>
              <p className="text-sm text-muted-foreground">
                Effective from: {formatDate(permanentAssignment.effectiveDate)}
              </p>
              {permanentAssignment.assignmentType === 'temporary' && permanentAssignment.startDate && permanentAssignment.endDate && (
                <p className="text-sm text-muted-foreground">
                  Temporary: {formatDate(permanentAssignment.startDate)} - {formatDate(permanentAssignment.endDate)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Shifts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Shifts (Next 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingRoster.length > 0 ? (
            <div className="space-y-3">
              {upcomingRoster.map((entry) => (
                <div
                  key={entry._id}
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    entry.isWeeklyOff
                      ? 'bg-gray-50 dark:bg-gray-800'
                      : 'bg-blue-50 dark:bg-blue-900/20'
                  }`}
                >
                  <div>
                    <p className="font-medium">{formatDate(entry.date)}</p>
                    {entry.isWeeklyOff ? (
                      <p className="text-sm text-muted-foreground">Weekly Off</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {entry.shiftId.name} • {entry.shiftId.startTime} - {entry.shiftId.endTime}
                      </p>
                    )}
                  </div>
                  {!entry.isWeeklyOff && entry.shiftId.isNightShift && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Night</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No upcoming shifts scheduled</p>
          )}
        </CardContent>
      </Card>

      {/* My Swap Requests */}
      {mySwapRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>My Pending Swap Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mySwapRequests.map((swap) => (
                <div key={swap._id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      Swap with {swap.requesteeId.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(swap.requesterDate)} <ArrowRight className="inline h-3 w-3" /> {formatDate(swap.requesteeDate)}
                    </p>
                    <p className="text-sm text-muted-foreground">Reason: {swap.reason}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancelSwap(swap._id)}
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Swap Request Dialog */}
      <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Shift Swap</DialogTitle>
            <DialogDescription>
              Request to swap shifts with another employee
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="requestee">Swap With *</Label>
              <Select
                value={swapFormData.requesteeId}
                onValueChange={(value) => setSwapFormData({ ...swapFormData, requesteeId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp._id} value={emp._id}>
                      {emp.name} ({emp.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="requesterDate">Your Date *</Label>
                <Input
                  id="requesterDate"
                  type="date"
                  value={swapFormData.requesterDate}
                  onChange={(e) => setSwapFormData({ ...swapFormData, requesterDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="requesteeDate">Their Date *</Label>
                <Input
                  id="requesteeDate"
                  type="date"
                  value={swapFormData.requesteeDate}
                  onChange={(e) => setSwapFormData({ ...swapFormData, requesteeDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={swapFormData.reason}
                onChange={(e) => setSwapFormData({ ...swapFormData, reason: e.target.value })}
                rows={3}
                placeholder="Explain why you need to swap shifts..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSwap}>Request Swap</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

