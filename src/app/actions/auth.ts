"use server";

import { cookies } from "next/headers";
import { odooClient } from "@/lib/odoo";
import { signSession, verifySession, type SessionUser } from "@/lib/session";

const SESSION_COOKIE_NAME = "arcade_session";
const USER_COOKIE_NAME = "arcade_user";

// Durée de la session (c'est NOUS qui décidons maintenant, plus Odoo).
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

// Domaine de cookie optionnel (ex. ".monsite.com") : la session devient
// "same-site" dans l'iframe quand l'app est servie sur un sous-domaine.
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

// Options communes aux cookies de session.
// - sameSite "none" + secure : requis pour un contexte d'iframe cross-site.
// - partitioned (CHIPS) : autorise le cookie dans une iframe tierce sur
//   Chrome/Edge/Firefox (partitionné par site parent) au lieu d'être bloqué.
//   NB: Safari n'honore pas CHIPS -> la solution durable reste le sous-domaine.
function baseCookieOptions() {
  const opts: Record<string, unknown> = {
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    partitioned: true,
  };
  if (COOKIE_DOMAIN) opts.domain = COOKIE_DOMAIN;
  return opts;
}

export async function setSessionCookie(token: string, user?: any) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, { ...baseCookieOptions(), httpOnly: true } as any);

  if (user) {
    // Cookie lisible côté client, pour l'affichage uniquement (jamais une
    // preuve d'identité : seule la signature d'arcade_session fait foi).
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
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(USER_COOKIE_NAME);
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
