/*
 * Session signée par l'app (HMAC-SHA256 avec SESSION_SECRET).
 *
 * Odoo n'est plus appelé qu'AU LOGIN : entre deux logins, c'est ce jeton
 * signé (stocké dans le cookie arcade_session) qui prouve l'identité du
 * joueur. Sans la signature, impossible de se faire passer pour un autre uid.
 *
 * Format du jeton : base64url(JSON payload) + "." + base64url(signature)
 * Payload : { uid, name, username, exp } (exp = timestamp UNIX en secondes)
 */
import { createHmac, timingSafeEqual } from "crypto";

export interface SessionUser {
  uid: number;
  name: string;
  username: string;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Configuration manquante : définir SESSION_SECRET (voir .env.example).");
  }
  return secret;
}

function hmac(payload: string): Buffer {
  return createHmac("sha256", getSecret()).update(payload).digest();
}

/** Crée un jeton signé pour l'utilisateur (durée en secondes). */
export function signSession(
  user: { uid: number; name: string; username: string },
  maxAgeSeconds: number
): string {
  const payload: SessionUser = {
    uid: user.uid,
    name: user.name || "",
    username: user.username || "",
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = hmac(encoded).toString("base64url");
  return `${encoded}.${signature}`;
}

/** Vérifie signature + expiration. Renvoie le payload, ou null si invalide. */
export function verifySession(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  let given: Buffer;
  try {
    given = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  const expected = hmac(encoded);
  // Comparaison à temps constant (évite les attaques par chronométrage).
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionUser;
    if (!payload || typeof payload.uid !== "number") return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
