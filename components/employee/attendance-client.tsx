'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Clock, CheckCircle, XCircle, AlertCircle, Calendar, Briefcase } from 'lucide-react';
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
  const [todayShift, setTodayShift] = useState<{
    name: string;
    startTime: string;
    endTime: string;
    gracePeriod: number;
  } | null>(null);

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

  const fetchTodayShift = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/shifts/roster?startDate=${today}&endDate=${today}`);
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0 && !data[0].isWeeklyOff && data[0].shiftId) {
          setTodayShift({
            name: data[0].shiftId.name,
            startTime: data[0].shiftId.startTime,
            endTime: data[0].shiftId.endTime,
            gracePeriod: data[0].shiftId.gracePeriod || 15,
          });
        } else {
          // Check permanent assignment
          const assignmentResponse = await fetch('/api/shifts/assignments?assignmentType=permanent');
          if (assignmentResponse.ok) {
            const assignments = await assignmentResponse.json();
            const myAssignment = assignments.find((a: any) => a.assignmentScope === 'employee' && a.isActive);
            if (myAssignment && myAssignment.shiftId) {
              setTodayShift({
                name: myAssignment.shiftId.name,
                startTime: myAssignment.shiftId.startTime,
                endTime: myAssignment.shiftId.endTime,
                gracePeriod: myAssignment.shiftId.gracePeriod || 15,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch today shift');
    }
  };

  useEffect(() => {
    fetchTodayAttendance();
    fetchAttendanceHistory();
    fetchTodayShift();
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
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">
          Attendance
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-1 sm:mt-2">
          Check in/out and view your attendance history
        </p>
      </div>

      {/* Today's Shift Card */}
      {todayShift && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Briefcase className="h-4 w-4 sm:h-5 sm:w-5" />
              Today's Shift
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-base sm:text-lg font-semibold">{todayShift.name}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {todayShift.startTime} - {todayShift.endTime}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-muted-foreground">Grace Period</p>
                <p className="text-sm font-medium">{todayShift.gracePeriod} minutes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Attendance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Today's Attendance
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">{formatDate(new Date())}</CardDescription>
        </CardHeader>
        <CardContent>
          {todayAttendance ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                    Check In
                  </p>
                  <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                    {formatDateTime(todayAttendance.checkIn)}
                  </p>
                  {todayAttendance.isLate && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Late arrival</p>
                  )}
                </div>
                {todayAttendance.checkOut ? (
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                      Check Out
                    </p>
                    <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
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
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                      Check Out
                    </p>
                    <p className="text-base sm:text-lg font-semibold text-gray-500">Not checked out</p>
                  </div>
                )}
              </div>
              {todayAttendance.workingHours && (
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                    Working Hours
                  </p>
                  <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                    {formatWorkingHours(todayAttendance.workingHours)}
                  </p>
                </div>
              )}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 sm:pt-4 border-t">
                {getStatusBadge(
                  todayAttendance.status,
                  todayAttendance.isLate,
                  todayAttendance.isEarlyExit
                )}
                {canCheckOut && (
                  <Button onClick={handleCheckOut} disabled={checkingOut} size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                    {checkingOut ? (
                      <>
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                        Checking Out...
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Check Out
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <Clock className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-sm sm:text-base text-gray-600 dark:text-[hsl(var(--muted-foreground))] mb-3 sm:mb-4">
                You haven't checked in today
              </p>
              <Button onClick={handleCheckIn} disabled={checkingIn} size="sm" className="text-xs sm:text-sm">
                {checkingIn ? (
                  <>
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                    Checking In...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
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
          <CardTitle className="text-base sm:text-lg">Attendance History (Last 30 Days)</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Your recent attendance records</CardDescription>
        </CardHeader>
        <CardContent>
          {attendanceHistory.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-xs sm:text-sm text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
              No attendance records found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      Date
                    </th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-[hsl(var(--foreground))] hidden sm:table-cell">
                      Check In
                    </th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-[hsl(var(--foreground))] hidden md:table-cell">
                      Check Out
                    </th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-[hsl(var(--foreground))] hidden lg:table-cell">
                      Hours
                    </th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-[hsl(var(--foreground))]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceHistory.map((record) => (
                    <tr key={record._id} className="border-b hover:bg-gray-50 dark:hover:bg-[hsl(var(--muted))]">
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm">{formatDate(record.date)}</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm hidden sm:table-cell">
                        {formatDateTime(record.checkIn)}
                        {record.isLate && (
                          <span className="ml-1 sm:ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                            (Late)
                          </span>
                        )}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm hidden md:table-cell">
                        {record.checkOut ? (
                          <>
                            {formatDateTime(record.checkOut)}
                            {record.isEarlyExit && (
                              <span className="ml-1 sm:ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                                (Early)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm hidden lg:table-cell">
                        {record.workingHours
                          ? formatWorkingHours(record.workingHours)
                          : '-'}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm">
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

