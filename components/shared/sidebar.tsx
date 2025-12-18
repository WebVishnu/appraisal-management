'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  BarChart3,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Target,
  Clock,
  Plane,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserRole } from '@/types';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: Record<UserRole, NavItem[]> = {
  super_admin: [
    { name: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard },
    { name: 'User Management', href: '/dashboard/admin/users', icon: UserCog },
    { name: 'Reports', href: '/dashboard/admin/reports', icon: BarChart3 },
  ],
  hr: [
    { name: 'Dashboard', href: '/dashboard/hr', icon: LayoutDashboard },
    { name: 'Employees', href: '/dashboard/hr/employees', icon: Users },
    { name: 'Appraisal Cycles', href: '/dashboard/hr/cycles', icon: Calendar },
    { name: 'Attendance', href: '/dashboard/hr/attendance', icon: Clock },
    { name: 'Leave Management', href: '/dashboard/hr/leave', icon: Plane },
    { name: 'Work Reports', href: '/dashboard/hr/work-reports', icon: ClipboardList },
    { name: 'Reports', href: '/dashboard/hr/reports', icon: BarChart3 },
  ],
  manager: [
    { name: 'Dashboard', href: '/dashboard/manager', icon: LayoutDashboard },
    { name: 'Team Reviews', href: '/dashboard/manager/reviews', icon: FileText },
    { name: 'Team Attendance', href: '/dashboard/manager/attendance', icon: Clock },
    { name: 'Team Leaves', href: '/dashboard/manager/leave', icon: Plane },
    { name: 'Work Reports', href: '/dashboard/manager/work-reports', icon: ClipboardList },
    { name: 'Goals', href: '/dashboard/manager/goals', icon: Target },
    { name: 'Calendar', href: '/dashboard/manager/calendar', icon: Calendar },
  ],
  employee: [
    { name: 'Dashboard', href: '/dashboard/employee', icon: LayoutDashboard },
    { name: 'Attendance', href: '/dashboard/employee/attendance', icon: Clock },
    { name: 'Leave', href: '/dashboard/employee/leave', icon: Plane },
    { name: 'Work Reports', href: '/dashboard/employee/work-reports', icon: ClipboardList },
    { name: 'My Appraisals', href: '/dashboard/employee/appraisals', icon: FileText },
    { name: 'Performance History', href: '/dashboard/employee/performance-history', icon: BarChart3 },
    { name: 'Goals', href: '/dashboard/employee/goals', icon: Target },
  ],
};

interface SidebarProps {
  role: UserRole;
  isMobile?: boolean;
  onClose?: () => void;
}

export function Sidebar({ role, isMobile = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const navItems = navigation[role] || [];

  const handleLinkClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <aside
      className={cn(
        'bg-white dark:bg-[hsl(var(--card))] border-r border-gray-200 dark:border-[hsl(var(--border))] transition-all duration-300 shadow-sm',
        collapsed && !isMobile ? 'w-16' : 'w-64',
        isMobile ? 'fixed inset-y-0 left-0 z-50 w-64' : 'sticky top-0 h-screen'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[hsl(var(--border))]">
          {!collapsed && !isMobile && (
            <h2 className="text-lg font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">
              HR System
            </h2>
          )}
          {isMobile && (
            <>
              <h2 className="text-lg font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">
                HR System
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onClose) {
                    onClose();
                  }
                }}
                className="ml-auto hover:bg-gray-100 dark:hover:bg-[hsl(var(--muted))] relative z-50"
                aria-label="Close menu"
                type="button"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-[hsl(var(--foreground))]" />
              </Button>
            </>
          )}
          {!isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className="hover:bg-gray-100 dark:hover:bg-[hsl(var(--muted))]"
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5 text-gray-600 dark:text-[hsl(var(--foreground))]" />
              ) : (
                <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-[hsl(var(--foreground))]" />
              )}
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            // More precise active link detection - exact match or starts with path followed by /
            // Special handling for dashboard routes to avoid false positives
            let isActive = false;
            if (item.href === '/dashboard/admin' || item.href === '/dashboard/hr' || 
                item.href === '/dashboard/manager' || item.href === '/dashboard/employee') {
              // For dashboard routes, match exactly or exact match with trailing slash
              isActive = pathname === item.href || pathname === item.href + '/';
            } else {
              // For other routes, match exactly or starts with the path followed by /
              isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-800'
                    : 'text-gray-700 dark:text-[hsl(var(--foreground))] hover:bg-gray-100 dark:hover:bg-[hsl(var(--muted))]',
                  collapsed && 'justify-center'
                )}
              >
                <Icon className={cn(
                  'h-5 w-5 flex-shrink-0',
                  isActive ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-[hsl(var(--muted-foreground))]'
                )} />
                {!collapsed && <span className={isActive ? 'font-semibold' : ''}>{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

