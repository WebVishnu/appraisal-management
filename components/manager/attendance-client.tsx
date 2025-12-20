'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Clock, Calendar, Search, Download } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import { formatWorkingHours } from '@/lib/utils/attendance';
import { SkeletonCard } from '@/components/shared/skeleton-loader';

interface AttendanceRecord {
  _id: string;
  employeeId: {
    _id: string;
    name: string;
    employeeId: string;
    email: string;
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

export default function ManagerAttendanceClient() {
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/attendance?startDate=${startDate}&endDate=${endDate}`
      );
      if (response.ok) {
        const data = await response.json();
        setAttendance(data);
      } else {
        toast.error('Failed to fetch attendance');
      }
    } catch (error) {
      toast.error('Failed to fetch attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [startDate, endDate]);

  const filteredAttendance = attendance.filter((record) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      record.employeeId.name.toLowerCase().includes(search) ||
      record.employeeId.employeeId.toLowerCase().includes(search) ||
      record.employeeId.email.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (status: string, isLate: boolean, isEarlyExit: boolean) => {
    if (status === 'missed_checkout') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
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
          Absent
        </span>
      );
    }
    if (isLate || isEarlyExit) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          {isLate && isEarlyExit ? 'Late & Early' : isLate ? 'Late' : 'Early Exit'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        Present
      </span>
    );
  };

  // Group attendance by employee
  const groupedByEmployee = filteredAttendance.reduce((acc, record) => {
    const empId = record.employeeId._id;
    if (!acc[empId]) {
      acc[empId] = {
        employee: record.employeeId,
        records: [],
      };
    }
    acc[empId].records.push(record);
    return acc;
  }, {} as Record<string, { employee: AttendanceRecord['employeeId']; records: AttendanceRecord[] }>);

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">
          Team Attendance
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-[hsl(var(--muted-foreground))] mt-1 sm:mt-2">
          View and monitor your team's attendance records
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-[hsl(var(--foreground))] mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-[hsl(var(--foreground))] mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs sm:text-sm"
              />
            </div>
            <div className="sm:col-span-2 md:col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-[hsl(var(--foreground))] mb-1">
                Search Employee
              </label>
              <div className="relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name, ID, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 sm:pl-10 text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Records */}
      {Object.keys(groupedByEmployee).length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
            No attendance records found for the selected period
          </CardContent>
        </Card>
      ) : (
        Object.values(groupedByEmployee).map(({ employee, records }) => (
          <Card key={employee._id}>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">{employee.name}</CardTitle>
              <CardDescription className="text-xs sm:text-sm break-words">
                {employee.employeeId} • {employee.email} • {records.length} record(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                    {records.map((record) => (
                      <tr
                        key={record._id}
                        className="border-b hover:bg-gray-50 dark:hover:bg-[hsl(var(--muted))]"
                      >
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
                          {record.workingHours ? formatWorkingHours(record.workingHours) : '-'}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm">
                          {getStatusBadge(record.status, record.isLate, record.isEarlyExit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

