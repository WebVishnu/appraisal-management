'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Calendar, Clock, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils/format';
import { SkeletonCard } from '@/components/shared/skeleton-loader';

interface RosterEntry {
  _id: string;
  employeeId: {
    _id: string;
    name: string;
    employeeId: string;
  };
  shiftId: {
    _id: string;
    name: string;
    startTime: string;
    endTime: string;
  };
  date: string;
  isWeeklyOff: boolean;
  notes?: string;
}

interface ShiftSwap {
  _id: string;
  requesterId: {
    _id: string;
    name: string;
    employeeId: string;
  };
  requesteeId: {
    _id: string;
    name: string;
    employeeId: string;
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

export default function ManagerRosterClient() {
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [swapRequests, setSwapRequests] = useState<ShiftSwap[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  useEffect(() => {
    fetchRoster();
    fetchSwapRequests();
  }, [startDate, endDate]);

  const fetchRoster = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/shifts/roster?startDate=${startDate}&endDate=${endDate}`
      );
      if (response.ok) {
        const data = await response.json();
        setRoster(data);
      }
    } catch (error) {
      toast.error('Failed to fetch roster');
    } finally {
      setLoading(false);
    }
  };

  const fetchSwapRequests = async () => {
    try {
      const response = await fetch('/api/shifts/swaps?status=pending');
      if (response.ok) {
        const data = await response.json();
        setSwapRequests(data);
      }
    } catch (error) {
      toast.error('Failed to fetch swap requests');
    }
  };

  const handleReviewSwap = async (swapId: string, status: 'approved' | 'rejected', reason?: string) => {
    try {
      const response = await fetch(`/api/shifts/swaps/${swapId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rejectionReason: reason }),
      });

      if (response.ok) {
        toast.success(`Swap request ${status} successfully`);
        fetchSwapRequests();
        fetchRoster();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to review swap');
      }
    } catch (error) {
      toast.error('Failed to review swap');
    }
  };

  // Group roster by employee
  const rosterByEmployee = roster.reduce((acc, entry) => {
    const empId = entry.employeeId._id;
    if (!acc[empId]) {
      acc[empId] = {
        employee: entry.employeeId,
        entries: [],
      };
    }
    acc[empId].entries.push(entry);
    return acc;
  }, {} as Record<string, { employee: any; entries: RosterEntry[] }>);

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Roster</h1>
          <p className="text-muted-foreground">View and manage your team's shift schedule</p>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
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
          </div>
        </CardContent>
      </Card>

      {/* Pending Swap Requests */}
      {swapRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Pending Shift Swap Requests
            </CardTitle>
            <CardDescription>Review and approve shift swap requests from your team</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {swapRequests.map((swap) => (
                <Card key={swap._id} className="border-l-4 border-l-orange-500">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium mb-2">
                          {swap.requesterId.name} wants to swap with {swap.requesteeId.name}
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Requester Date:</p>
                            <p className="font-medium">{formatDate(swap.requesterDate)}</p>
                            <p className="text-xs text-muted-foreground">
                              Shift: {swap.requesterShiftId.name}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Requestee Date:</p>
                            <p className="font-medium">{formatDate(swap.requesteeDate)}</p>
                            <p className="text-xs text-muted-foreground">
                              Shift: {swap.requesteeShiftId.name}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Reason: {swap.reason}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleReviewSwap(swap._id, 'approved')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            const reason = prompt('Rejection reason:');
                            if (reason) {
                              handleReviewSwap(swap._id, 'rejected', reason);
                            }
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roster Calendar */}
      <div className="space-y-4">
        {Object.values(rosterByEmployee).map(({ employee, entries }) => (
          <Card key={employee._id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {employee.name} ({employee.employeeId})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-7">
                {entries
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((entry) => (
                    <div
                      key={entry._id}
                      className={`p-3 border rounded-lg ${
                        entry.isWeeklyOff
                          ? 'bg-gray-100 dark:bg-gray-800'
                          : 'bg-blue-50 dark:bg-blue-900/20'
                      }`}
                    >
                      <p className="text-xs font-medium mb-1">
                        {formatDate(entry.date)}
                      </p>
                      {entry.isWeeklyOff ? (
                        <p className="text-xs text-muted-foreground">Weekly Off</p>
                      ) : (
                        <div>
                          <p className="text-xs font-medium">{entry.shiftId.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.shiftId.startTime} - {entry.shiftId.endTime}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {Object.keys(rosterByEmployee).length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No roster entries found for the selected period
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

