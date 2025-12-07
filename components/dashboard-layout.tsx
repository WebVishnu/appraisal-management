'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserRole } from '@/types';

const navigation: Record<UserRole, { name: string; href: string }[]> = {
  super_admin: [
    { name: 'Dashboard', href: '/dashboard/admin' },
    { name: 'User Management', href: '/dashboard/admin/users' },
    { name: 'Reports', href: '/dashboard/admin/reports' },
  ],
  hr: [
    { name: 'Dashboard', href: '/dashboard/hr' },
    { name: 'Employees', href: '/dashboard/hr/employees' },
    { name: 'Appraisal Cycles', href: '/dashboard/hr/cycles' },
    { name: 'Reports', href: '/dashboard/hr/reports' },
  ],
  manager: [
    { name: 'Dashboard', href: '/dashboard/manager' },
    { name: 'Team Reviews', href: '/dashboard/manager/reviews' },
  ],
  employee: [
    { name: 'Dashboard', href: '/dashboard/employee' },
    { name: 'My Appraisals', href: '/dashboard/employee/appraisals' },
  ],
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  if (!session?.user) {
    return null;
  }

  const role = session.user.role as UserRole;
  const navItems = navigation[role] || [];

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold">HR Management System</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${
                      pathname === item.href
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <span>{session.user.email}</span>
                    <span className="text-xs text-gray-500">({role.replace('_', ' ')})</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

