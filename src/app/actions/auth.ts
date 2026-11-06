"use server";

import { cookies } from "next/headers";
import { odooClient } from "@/lib/odoo";
import { signSession, verifySession, type SessionUser } from "@/lib/session";

// Suffixe "_v2" (07/11/2026) : les anciens cookies étaient posés avec
// `partitioned` (CHIPS), donc stockés à part par le navigateur. En changeant
// de nom, l'app ne lit plus jamais l'ancienne copie ; elle expire seule
// (7 jours). Même nom en dur dans src/middleware.ts.
const SESSION_COOKIE_NAME = "arcade_session_v2";
const USER_COOKIE_NAME = "arcade_user_v2";

// Durée de la session (c'est NOUS qui décidons maintenant, plus Odoo).
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

// Domaine de cookie optionnel (ex. ".monsite.com") : partagé entre les
// sous-domaines (elsass-game. et elsass-game-dev.).
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

// Options communes aux cookies de session. L'arcade est ouverte directement
// dans le navigateur (plus d'iframe Odoo) : sameSite "lax" suffit, et le jeu
// est une iframe de même origine, donc le cookie lui parvient aussi.
function baseCookieOptions() {
  const opts: Record<string, unknown> = {
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
  if (COOKIE_DOMAIN) opts.domain = COOKIE_DOMAIN;
  return opts;
}

export async function setSessionCookie(token: string, user?: any) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, { ...baseCookieOptions(), httpOnly: true } as any);

  if (user) {
    // Cookie lisible côté client, pour l'affichage uniquement (jamais une
    // preuve d'identité : seule la signature d'arcade_session_v2 fait foi).
    cookieStore.set(USER_COOKIE_NAME, JSON.stringify(user), { ...baseCookieOptions(), httpOnly: false } as any);
  }
}

/**
 * Renvoie l'utilisateur AUTHENTIFIÉ (signature HMAC + expiration vérifiées),
 * ou null si la session est absente/invalide/expirée.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySession(token);
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  // Un cookie ne s'efface que si le navigateur reçoit les MÊMES attributs
  // (domain, path) qu'à la pose : un simple delete(nom) sans domaine laisse
  // le cookie posé sur COOKIE_DOMAIN en place.
  const effacement = { ...baseCookieOptions(), maxAge: 0 };
  cookieStore.set(SESSION_COOKIE_NAME, "", { ...effacement, httpOnly: true } as any);
  cookieStore.set(USER_COOKIE_NAME, "", { ...effacement, httpOnly: false } as any);
}

export async function signInAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, error: "Email et mot de passe requis" };
  }

  try {
    // Odoo n'est appelé QU'ICI : simple vérification des identifiants portail.
    const { user } = await odooClient.authenticate(email, password);

    const slimUser = {
      uid: user?.uid,
      name: user?.name,
      username: user?.username,
    };

    // C'est l'app qui signe la session (HMAC) : plus de dépendance à la
    // validité de la session Odoo entre deux logins.
    const token = signSession(slimUser, SESSION_MAX_AGE);
    await setSessionCookie(token, slimUser);
    return { success: true, user: slimUser };
  } catch (error: any) {
    console.error("Auth error:", error);
    return { success: false, error: error.message || "Erreur lors de l'authentification" };
  }
}

export async function signOutAction() {
  await clearSessionCookie();
}
