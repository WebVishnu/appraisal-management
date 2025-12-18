'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Clock, CheckCircle, XCircle, AlertCircle, Calendar } from 'lucide-react';
import { formatDateTime, formatDate } from '@/lib/utils/format';
import { formatWorkingHours } from '@/lib/utils/attendance';
import { SkeletonCard } from '@/components/shared/skeleton-loader';

interface AttendanceRecord {
  _id: string;
  employeeId: {
    _id: string;
    name: string;
    employeeId: string;
  };
  date: string;
  checkIn: string;
  checkOut?: string;
  workingHours?: number;
  isLate: boolean;
  isEarlyExit: boolean;
  status: 'present' | 'absent' | 'half_day' | 'missed_checkout';
  notes?: string;
}

export default function AttendanceClient() {
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [canCheckIn, setCanCheckIn] = useState(false);
  const [canCheckOut, setCanCheckOut] = useState(false);

  const fetchTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/attendance?startDate=${today}&endDate=${today}`);
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setTodayAttendance(data[0]);
          setCanCheckIn(false);
          setCanCheckOut(!data[0].checkOut);
        } else {
          setTodayAttendance(null);
          setCanCheckIn(true);
          setCanCheckOut(false);
        }
      }
    } catch (error) {
      toast.error('Failed to fetch today\'s attendance');
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days

      const response = await fetch(
        `/api/attendance?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`
      );
      if (response.ok) {
        const data = await response.json();
        setAttendanceHistory(data);
      }
    } catch (error) {
      toast.error('Failed to fetch attendance history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayAttendance();
    fetchAttendanceHistory();
  }, []);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Checked in successfully');
        await fetchTodayAttendance();
        await fetchAttendanceHistory();
      } else {
        toast.error(data.error || 'Failed to check in');
      }
    } catch (error) {
      toast.error('Failed to check in');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckingOut(true);
    try {
      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Checked out successfully');
        await fetchTodayAttendance();
        await fetchAttendanceHistory();
      } else {
        toast.error(data.error || 'Failed to check out');
      }
    } catch (error) {
      toast.error('Failed to check out');
    } finally {
      setCheckingOut(false);
    }
  };

  const getStatusBadge = (status: string, isLate: boolean, isEarlyExit: boolean) => {
    if (status === 'missed_checkout') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Missed Checkout
        </span>
      );
    }
    if (status === 'half_day') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
          Half Day
        </span>
      );
    }
    if (status === 'absent') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          Absent
        </span>
      );
    }
    if (isLate || isEarlyExit) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          {isLate && isEarlyExit ? 'Late & Early Exit' : isLate ? 'Late' : 'Early Exit'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Present
      </span>
    );
  };

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">
          Attendance
        </h1>
        <p className="text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-2">
          Check in/out and view your attendance history
        </p>
      </div>

      {/* Today's Attendance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today's Attendance
          </CardTitle>
          <CardDescription>{formatDate(new Date())}</CardDescription>
        </CardHeader>
        <CardContent>
          {todayAttendance ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                    Check In
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                    {formatDateTime(todayAttendance.checkIn)}
                  </p>
                  {todayAttendance.isLate && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Late arrival</p>
                  )}
                </div>
                {todayAttendance.checkOut ? (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                      Check Out
                    </p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      {formatDateTime(todayAttendance.checkOut)}
                    </p>
                    {todayAttendance.isEarlyExit && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        Early exit
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                      Check Out
                    </p>
                    <p className="text-lg font-semibold text-gray-500">Not checked out</p>
                  </div>
                )}
              </div>
              {todayAttendance.workingHours && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                    Working Hours
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                    {formatWorkingHours(todayAttendance.workingHours)}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between pt-4 border-t">
                {getStatusBadge(
                  todayAttendance.status,
                  todayAttendance.isLate,
                  todayAttendance.isEarlyExit
                )}
                {canCheckOut && (
                  <Button onClick={handleCheckOut} disabled={checkingOut}>
                    {checkingOut ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Checking Out...
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 mr-2" />
                        Check Out
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-[hsl(var(--muted-foreground))] mb-4">
                You haven't checked in today
              </p>
              <Button onClick={handleCheckIn} disabled={checkingIn} size="lg">
                {checkingIn ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Checking In...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Check In
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance History */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance History (Last 30 Days)</CardTitle>
          <CardDescription>Your recent attendance records</CardDescription>
        </CardHeader>
        <CardContent>
          {attendanceHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
              No attendance records found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      Check In
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      Check Out
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      Hours
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceHistory.map((record) => (
                    <tr key={record._id} className="border-b hover:bg-gray-50 dark:hover:bg-[hsl(var(--muted))]">
                      <td className="py-3 px-4">{formatDate(record.date)}</td>
                      <td className="py-3 px-4">
                        {formatDateTime(record.checkIn)}
                        {record.isLate && (
                          <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                            (Late)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {record.checkOut ? (
                          <>
                            {formatDateTime(record.checkOut)}
                            {record.isEarlyExit && (
                              <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                                (Early)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {record.workingHours
                          ? formatWorkingHours(record.workingHours)
                          : '-'}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(record.status, record.isLate, record.isEarlyExit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

