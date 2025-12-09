'use client';

import { useState } from 'react';
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
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Sidebar } from '@/components/shared/sidebar';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Menu } from 'lucide-react';


export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!session?.user) {
    return null;
  }

  const role = session.user.role as UserRole;

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[hsl(var(--background))] flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar role={role} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-40 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-64'
          }`}
      >
        <Sidebar role={role} isMobile onClose={() => setMobileMenuOpen(false)} />
      </div>
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[hsl(var(--background))]">
        {/* Top Navigation Bar */}
        <nav className="bg-white dark:bg-[hsl(var(--card))] border-b border-gray-200 dark:border-[hsl(var(--border))] shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden mr-2 hover:bg-gray-100 dark:hover:bg-[hsl(var(--muted))]"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <Menu className="h-5 w-5 text-gray-600 dark:text-[hsl(var(--foreground))]" />
                </Button>
                <h1 className=" hidden md:block text-xl font-bold text-gray-900 dark:text-[hsl(var(--foreground))]">
                  HR Management System
                </h1>

              </div>
              <div className="flex items-center gap-4">
                <ThemeToggle />
                <NotificationBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2">
                      <span className="hidden sm:inline text-gray-900 dark:text-[hsl(var(--foreground))]">{session.user.email}</span>
                      <span className="text-xs text-gray-500 dark:text-[hsl(var(--muted-foreground))]">
                        ({role.replace('_', ' ')})
                      </span>
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

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-white dark:bg-[hsl(var(--background))]">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

