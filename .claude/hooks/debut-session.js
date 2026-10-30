// SessionStart — donne à Claude, dès le démarrage, l'état du projet :
// branche, propreté du working tree, commits de dev pas encore en prod,
// puis le contenu d'ETAT.md (fiche locale, gitignorée).
//
// Ne lit pas stdin. Ne sort jamais en erreur : un souci → une ligne
// d'avertissement et exit 0 (on ne bloque jamais l'ouverture d'une session).
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE_DEPOT = path.resolve(__dirname, "..", "..");

function git(args) {
  const r = spawnSync("git", args, { cwd: RACINE_DEPOT, encoding: "utf8", timeout: 4000 });
  return r.status === 0 ? (r.stdout || "").trim() : null;
}

function main() {
  const lignes = ["=== Elsass-Game — début de session ==="];

  const branche = git(["branch", "--show-current"]);
  lignes.push(`Branche : ${branche || "(inconnue)"}`);

  const statut = git(["status", "--porcelain"]);
  if (statut !== null) {
    const n = statut ? statut.split("\n").length : 0;
    lignes.push(n ? `Working tree : ${n} fichier(s) modifié(s) non commité(s)` : "Working tree : propre");
  }

  // Ce qui est sur dev mais pas encore en prod (refs locales, pas de fetch :
  // on reste rapide et hors réseau).
  const pasEnProd = git(["log", "--oneline", "origin/main..origin/dev"]);
  if (pasEnProd !== null) {
    const commits = pasEnProd ? pasEnProd.split("\n") : [];
    lignes.push(`Commits de dev pas encore en prod : ${commits.length}`);
    for (const c of commits.slice(0, 10)) lignes.push(`  ${c}`);
    if (commits.length > 10) lignes.push(`  … et ${commits.length - 10} de plus`);
  }

  const etat = path.join(RACINE_DEPOT, "ETAT.md");
  lignes.push("");
  if (fs.existsSync(etat)) {
    lignes.push("--- ETAT.md ---");
    lignes.push(fs.readFileSync(etat, "utf8").trim());
  } else {
    lignes.push("ETAT.md absent.");
  }

  process.stdout.write(lignes.join("\n") + "\n");
}

try {
  main();
} catch (e) {
  process.stdout.write(`[debut-session] avertissement : ${e && e.message}\n`);
}
process.exitCode = 0;
