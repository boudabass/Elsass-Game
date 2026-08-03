"use server";

/*
 * Actions serveur de la page /admin (gestion du catalogue de jeux).
 * CHAQUE action re-vérifie que l'utilisateur est bien l'admin (ADMIN_UID) :
 * ne jamais faire confiance au seul affichage de la page.
 */
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { getSessionUser } from "@/app/actions/auth";

async function requireAdmin() {
  const user = await getSessionUser();
  const adminUid = process.env.ADMIN_UID;
  if (!user || !adminUid || String(user.uid) !== adminUid) {
    throw new Error("Accès refusé");
  }
  return user;
}

export async function addGameAction(formData: FormData) {
  await requireAdmin();

  const name = (formData.get("name") as string || "").trim();
  const url = (formData.get("url") as string || "").trim();
  const description = (formData.get("description") as string || "").trim();
  const rawId = (formData.get("id") as string || "").trim();

  if (!name || !url) throw new Error("Nom et URL requis");

  if (rawId) {
    // ID choisi à la main (ex. recréer le template en 5) : on resynchronise
    // ensuite la séquence pour que les prochains IDs auto ne collisionnent pas.
    const id = parseInt(rawId, 10);
    if (Number.isNaN(id)) throw new Error("ID invalide");
    await query(
      "INSERT INTO game (id, name, description, url) VALUES ($1, $2, $3, $4)",
      [id, name, description, url]
    );
    await query(
      "SELECT setval(pg_get_serial_sequence('game', 'id'), (SELECT MAX(id) FROM game))"
    );
  } else {
    await query(
      "INSERT INTO game (name, description, url) VALUES ($1, $2, $3)",
      [name, description, url]
    );
  }
  revalidatePath("/admin");
}

export async function updateGameAction(formData: FormData) {
  await requireAdmin();

  const id = parseInt(formData.get("id") as string, 10);
  const name = (formData.get("name") as string || "").trim();
  const url = (formData.get("url") as string || "").trim();
  const description = (formData.get("description") as string || "").trim();

  if (Number.isNaN(id) || !name || !url) throw new Error("Champs invalides");

  await query(
    "UPDATE game SET name = $2, description = $3, url = $4 WHERE id = $1",
    [id, name, description, url]
  );
  revalidatePath("/admin");
}

export async function togglePublishedAction(formData: FormData) {
  await requireAdmin();

  const id = parseInt(formData.get("id") as string, 10);
  if (Number.isNaN(id)) throw new Error("ID invalide");

  await query("UPDATE game SET published = NOT published WHERE id = $1", [id]);
  revalidatePath("/admin");
}

export async function deleteGameAction(formData: FormData) {
  await requireAdmin();

  const id = parseInt(formData.get("id") as string, 10);
  if (Number.isNaN(id)) throw new Error("ID invalide");

  // Supprime aussi scores et sauvegardes du jeu (ON DELETE CASCADE).
  await query("DELETE FROM game WHERE id = $1", [id]);
  revalidatePath("/admin");
}
