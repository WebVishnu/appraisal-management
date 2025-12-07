import 'next-auth';
import { UserRole } from './index';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      role: UserRole;
      employeeId?: string;
    };
  }

  interface User {
    role: UserRole;
    employeeId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole;
    employeeId?: string;
  }
}

