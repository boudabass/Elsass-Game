import { NextResponse } from 'next/server';
import { getSessionUser } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Session signée vérifiée côté serveur (plus fiable que le cookie arcade_user).
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ user: null });
  }

  // Structure LocalUser attendue par le frontend.
  // Le rôle admin est déterminé côté serveur (ADMIN_UID) : il pilote
  // l'affichage du lien "Admin Panel" dans le menu utilisateur.
  const isAdmin = !!process.env.ADMIN_UID && String(sessionUser.uid) === process.env.ADMIN_UID;
  const user = {
    id: sessionUser.uid.toString(),
    email: sessionUser.username || '',
    name: sessionUser.name || '',
    role: isAdmin ? 'admin' : 'user',
  };
  return NextResponse.json({ user });
}
