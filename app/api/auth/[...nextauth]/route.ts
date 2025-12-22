import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { authService } from '@/lib/services/auth-service';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const email = String(credentials.email).toLowerCase().trim();
          const password = String(credentials.password);
          
          // Extract device info from NextAuth request
          // NextAuth req has different structure than NextRequest
          const userAgent = (req as any)?.headers?.['user-agent'] || 
                          (req as any)?.headers?.get?.('user-agent') || 
                          'unknown';
          const ipAddress = (req as any)?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
                          (req as any)?.headers?.['x-real-ip'] ||
                          (req as any)?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ||
                          (req as any)?.headers?.get?.('x-real-ip') ||
                          'unknown';

          const deviceInfo = {
            userAgent,
            ipAddress,
            deviceType: /mobile|android|iphone/i.test(userAgent) ? 'mobile' as const : 
                       /tablet|ipad/i.test(userAgent) ? 'tablet' as const : 'desktop' as const,
            platform: /mobile|android|iphone/i.test(userAgent) ? 'mobile' : 'web',
          };

          // Use the enterprise auth service
          const result = await authService.login(
            { email, password },
            deviceInfo
          );

          if (!result.success || !result.user) {
            // Return null to indicate authentication failure
            // NextAuth will handle the error appropriately
            return null;
          }

          return {
            id: result.user.id,
            email: result.user.email,
            role: result.user.role,
            employeeId: result.user.employeeId || undefined,
          };
        } catch (error: any) {
          console.error('NextAuth authorize error:', error);
          // Return null on any error - NextAuth will show generic error
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
        token.employeeId = user.employeeId;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.employeeId = token.employeeId as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt' as const,
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export const { handlers, auth } = handler;
export const { GET, POST } = handlers;
