/*
 * Détection des jeux présents dans public/games/ (côté serveur).
 * Évite de saisir les URLs à la main dans /admin : on scanne le dossier
 * et on propose en 1 clic les jeux qui ne sont pas encore au catalogue.
 *
 * Un "jeu" = un dossier contenant index.html, soit directement
 * (games/monjeu/index.html), soit dans un sous-dossier de version
 * (games/monjeu/v1/index.html).
 */
import { readdirSync, existsSync } from "fs";
import path from "path";

// Dossiers techniques à ignorer (socle partagé, pas des jeux).
const EXCLUDED = new Set(["system"]);

export interface DetectedGame {
  url: string;           // ex. /games/cerebro/v1/index.html
  suggestedName: string; // ex. "Cerebro (v1)"
}

// "elsass-farm" -> "Elsass Farm"
function prettyName(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function detectGames(): DetectedGame[] {
  const root = path.join(process.cwd(), "public", "games");
  const found: DetectedGame[] = [];
  if (!existsSync(root)) return found;

  for (const dir of readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory() || EXCLUDED.has(dir.name)) continue;
    const base = path.join(root, dir.name);

    if (existsSync(path.join(base, "index.html"))) {
      found.push({
        url: `/games/${dir.name}/index.html`,
        suggestedName: prettyName(dir.name),
      });
      continue;
    }

    // Sous-dossiers de version (v1, v2, ...)
    for (const sub of readdirSync(base, { withFileTypes: true })) {
      if (sub.isDirectory() && existsSync(path.join(base, sub.name, "index.html"))) {
        found.push({
          url: `/games/${dir.name}/${sub.name}/index.html`,
          suggestedName: `${prettyName(dir.name)} (${sub.name})`,
        });
      }
    }
  }

  return found.sort((a, b) => a.url.localeCompare(b.url));
}
