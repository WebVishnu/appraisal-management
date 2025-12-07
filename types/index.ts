export type UserRole = 'super_admin' | 'hr' | 'manager' | 'employee';

export type CycleStatus = 'draft' | 'open_self_review' | 'open_manager_review' | 'closed';

export type ReviewStatus = 'draft' | 'submitted';

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  employeeId?: string;
}

