import { auth } from '@/app/api/auth/[...nextauth]/route';
import { SessionUser } from '@/types';

export async function getSession(): Promise<{ user: SessionUser } | null> {
  const session = await auth();
  return session as { user: SessionUser } | null;
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}
