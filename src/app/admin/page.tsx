import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Plus, Eye, EyeOff, Trash2, Play, FolderSearch } from "lucide-react";
import { query } from "@/lib/db";
import { detectGames } from "@/lib/games-fs";
import { getSessionUser } from "@/app/actions/auth";
import {
  addGameAction,
  updateGameAction,
  togglePublishedAction,
  deleteGameAction,
} from "./actions";

/*
 * Gestion du catalogue (option B de la migration Postgres).
 * Page invisible pour les clients : tout uid différent d'ADMIN_UID reçoit
 * un 404, et chaque action serveur re-vérifie l'admin de son côté.
 */
export default async function AdminPage() {
  const user = await getSessionUser();
  const adminUid = process.env.ADMIN_UID;
  if (!user || !adminUid || String(user.uid) !== adminUid) {
    notFound();
  }

  let games: any[] = [];
  try {
    const { rows } = await query(
      "SELECT id, name, description, url, published FROM game ORDER BY id"
    );
    games = rows;
  } catch (e) {
    console.warn("Could not fetch games", e);
  }

  // Jeux présents dans public/games/ mais pas encore au catalogue
  // (comparaison sans la partie ?query des URLs enregistrées).
  const knownUrls = new Set(games.map((g) => String(g.url).split("?")[0]));
  const detected = detectGames().filter((d) => !knownUrls.has(d.url));

  return (
    <div className="container mx-auto py-8 space-y-8 animate-in fade-in duration-500">
      <div className="border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-indigo-600" />
          Gestion du catalogue
        </h1>
        <p className="text-slate-500 mt-2">
          Ajouter, modifier, publier ou retirer des jeux. L&apos;ID d&apos;un jeu est le{" "}
          <code className="bg-slate-100 px-1 rounded">?gid=</code> injecté dans son iframe.
        </p>
      </div>

      {/* Jeux détectés dans le dossier public/games */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderSearch className="w-5 h-5 text-indigo-600" /> Jeux détectés dans le dossier
          </CardTitle>
          <CardDescription>
            Trouvés dans <code>public/games/</code> et pas encore au catalogue. Un clic pour les ajouter (ils arrivent en « Publié » : masque-les ensuite si besoin).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {detected.length === 0 ? (
            <p className="text-slate-400 italic">Rien à ajouter : tous les jeux du dossier sont déjà au catalogue.</p>
          ) : (
            detected.map((d) => (
              <form key={d.url} action={addGameAction} className="flex flex-wrap items-center gap-3 border rounded-lg p-3">
                <input type="hidden" name="url" value={d.url} />
                <code className="text-xs bg-slate-100 px-2 py-1 rounded">{d.url}</code>
                <Input name="name" defaultValue={d.suggestedName} className="w-48" required />
                <Input name="id" type="number" placeholder="ID (auto)" className="w-28" />
                <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                </Button>
              </form>
            ))
          )}
        </CardContent>
      </Card>

      {/* Ajout d'un jeu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" /> Ajouter un jeu
          </CardTitle>
          <CardDescription>
            URL = chemin du jeu, ex. <code>/games/_template/v1/index.html</code>. ID vide = automatique.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addGameAction} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input name="name" placeholder="Nom du jeu" required />
            <Input name="url" placeholder="/games/mon-jeu/v1/index.html" required />
            <Textarea name="description" placeholder="Description (optionnel)" className="md:col-span-2" />
            <Input name="id" type="number" placeholder="ID (optionnel, sinon auto)" />
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="mr-2 w-4 h-4" /> Ajouter
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Liste des jeux */}
      <Card>
        <CardHeader>
          <CardTitle>Jeux ({games.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {games.length === 0 ? (
            <p className="text-slate-400 italic">Catalogue vide : ajoute ton premier jeu ci-dessus.</p>
          ) : (
            games.map((game) => (
              <div key={game.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">#{game.id}</span>
                    <span className="font-bold">{game.name}</span>
                    {game.published ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold">Publié</span>
                    ) : (
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-semibold">Masqué</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/play/${game.id}`}>
                      <Button variant="outline" size="sm">
                        <Play className="w-4 h-4 mr-1" /> Tester
                      </Button>
                    </Link>
                    <form action={togglePublishedAction}>
                      <input type="hidden" name="id" value={game.id} />
                      <Button variant="outline" size="sm" type="submit">
                        {game.published ? (
                          <><EyeOff className="w-4 h-4 mr-1" /> Masquer</>
                        ) : (
                          <><Eye className="w-4 h-4 mr-1" /> Publier</>
                        )}
                      </Button>
                    </form>
                    <form action={deleteGameAction}>
                      <input type="hidden" name="id" value={game.id} />
                      <Button variant="outline" size="sm" type="submit" className="text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4 mr-1" /> Supprimer
                      </Button>
                    </form>
                  </div>
                </div>

                {/* Modification en place */}
                <form action={updateGameAction} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input type="hidden" name="id" value={game.id} />
                  <Input name="name" defaultValue={game.name} required />
                  <Input name="url" defaultValue={game.url} required />
                  <Textarea name="description" defaultValue={game.description || ""} className="md:col-span-2" />
                  <Button variant="secondary" size="sm" type="submit" className="w-fit">
                    Enregistrer les modifications
                  </Button>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
