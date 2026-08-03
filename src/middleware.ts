import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/*
 * Protection des pages : sans cookie de session, on redirige vers /login
 * en mémorisant la page demandée (?next=) pour y revenir après connexion.
 *
 * NB : ceci ne vérifie que la PRÉSENCE du cookie (rapide, aucun appel
 * réseau). La validité de la session Odoo est vérifiée par les pages
 * elles-mêmes (OdooSessionExpiredError -> /login?expired=1).
 */

// Pages accessibles sans être connecté.
const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const hasSession = !!request.cookies.get('arcade_session')?.value;
  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') {
    loginUrl.searchParams.set('next', pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Tout sauf :
     *  - /api (les jeux appellent /api/scores et /api/storage)
     *  - les internes Next (_next/static, _next/image)
     *  - les fichiers statiques (tout chemin contenant un point :
     *    favicon.ico, /games/xxx/index.html, .js, .png, ...)
     */
    '/((?!api|_next/static|_next/image|.*\\..*).*)',
  ],
};
