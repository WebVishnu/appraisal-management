import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('[AUTH] Missing credentials');
          return null;
        }

        await connectDB();

        const email = String(credentials.email).toLowerCase();
        const password = String(credentials.password);
        // Don't populate employeeId - we only need the ObjectId reference
        const user = await User.findOne({ email });

        if (!user) {
          console.log('[AUTH] User not found:', email);
          return null;
        }

        if (!user.isActive) {
          console.log('[AUTH] User is inactive:', email);
          return null;
        }

        if (!user.password) {
          console.log('[AUTH] Password field is missing for user:', email);
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        console.log('[AUTH] Password check:', {
          email,
          passwordProvided: password,
          passwordHash: user.password?.substring(0, 20) + '...',
          isValid: isPasswordValid
        });

        if (!isPasswordValid) {
          console.log('[AUTH] Invalid password for:', email);
          return null;
        }

        return {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          employeeId: user.employeeId?.toString() || undefined,
        };
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
