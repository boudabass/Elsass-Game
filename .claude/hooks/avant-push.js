// PreToolUse (matcher Bash|PowerShell) — garde-fous avant un `git push`.
//
// 1. node --check sur chaque .js modifié entre l'amont et HEAD.
// 2. Contrôle des dépendances core/ : si un jeu utilise Arcade.UI.<nom>
//    défini dans un fichier de core/ que son index.html ne charge pas, le jeu
//    affiche un écran noir (cas réels : Quilles 04/09, Schieweschlawe 24/09).
//
// Erreur → exit 2 (le push est bloqué, message sur stderr).
// Commande qui n'est pas un `git push` → exit 0 sans rien écrire.
// Bug interne du hook → avertissement sur stderr et exit 0 (on ne bloque
// jamais John à cause d'un bug de ce script).
//
// Test sur une copie (les vrais index.html ne sont jamais modifiés) :
//   node .claude/hooks/avant-push.js --racine <copie de public/games>
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE_DEPOT = path.resolve(__dirname, "..", "..");
const JEUX_PAR_DEFAUT = path.join(RACINE_DEPOT, "public", "games");
// Dossiers de public/games qui ne sont pas un jeu.
const DOSSIERS_HORS_JEUX = new Set(["core", "assets", "vendor"]);

function git(args) {
  const r = spawnSync("git", args, { cwd: RACINE_DEPOT, encoding: "utf8" });
  return {
    ok: r.status === 0,
    sortie: (r.stdout || "").trim(),
    erreur: (r.stderr || "").trim(),
  };
}

// Retire commentaires et chaînes : on ne compte que le code exécutable.
function nettoyer(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
}

// Noms exposés par Arcade.UI : `Arcade.UI.nom = ...` et clés du littéral
// `Arcade.UI = { ... }` (ui.js : u, layout, couleur, iconesPlateforme...).
function nomsDefinis(code) {
  const noms = new Set();
  for (const m of code.matchAll(/Arcade\.UI\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) {
    noms.add(m[1]);
  }

  const debut = code.search(/Arcade\.UI\s*=\s*\{/);
  if (debut >= 0) {
    const ouvre = code.indexOf("{", debut);
    let niveau = 0;
    let fin = code.length;
    for (let i = ouvre; i < code.length; i++) {
      if (code[i] === "{") {
        niveau++;
      } else if (code[i] === "}") {
        niveau--;
        if (niveau === 0) {
          fin = i;
          break;
        }
      }
    }
    // Clés de premier niveau uniquement (celles à l'intérieur des fonctions ne comptent pas).
    let niveauLigne = 0;
    for (const ligne of code.slice(ouvre + 1, fin).split("\n")) {
      if (niveauLigne === 0) {
        const m = ligne.match(/^\s*([A-Za-z_$][\w$]*)\s*:/);
        if (m) noms.add(m[1]);
      }
      for (const c of ligne) {
        if (c === "{") niveauLigne++;
        else if (c === "}") niveauLigne--;
      }
    }
  }
  return noms;
}

// Noms de Arcade.UI utilisés dans un fichier, directement (`Arcade.UI.nom`)
// ou via un alias local (`const UI = Arcade.UI;` puis `UI.nom`, très répandu).
function usagesArcadeUI(code) {
  const noms = new Set();
  for (const m of code.matchAll(/Arcade\.UI\.([A-Za-z_$][\w$]*)/g)) noms.add(m[1]);

  for (const a of code.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*Arcade\.UI\s*;/g)) {
    // Le lookbehind évite de compter `Arcade.UI.x` ou `this.UI.x` comme un alias.
    const alias = a[1].replace(/\$/g, "\\$");
    const motif = new RegExp(`(?<![\\w$.])${alias}\\.([A-Za-z_$][\\w$]*)`, "g");
    for (const m of code.matchAll(motif)) noms.add(m[1]);
  }
  return noms;
}

function fichiersJs(dossier) {
  const sortie = [];
  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      if (entree.name !== "vendor") sortie.push(...fichiersJs(chemin));
    } else if (entree.name.endsWith(".js")) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

function relatif(racine, chemin) {
  return path.relative(racine, chemin).split(path.sep).join("/");
}

function cle(chemin) {
  return path.normalize(chemin).toLowerCase();
}

// Renvoie la liste des erreurs de dépendances (vide = tout va bien).
function controleDependances(racine) {
  const erreurs = [];

  // 1. Qui définit quoi dans core/ ?
  const definisPar = new Map();
  for (const f of fichiersJs(path.join(racine, "core"))) {
    const code = nettoyer(fs.readFileSync(f, "utf8"));
    for (const nom of nomsDefinis(code)) {
      if (!definisPar.has(nom)) definisPar.set(nom, []);
      definisPar.get(nom).push(relatif(racine, f));
    }
  }

  // 2. Pour chaque jeu, les scripts réellement chargés par son index.html.
  for (const entree of fs.readdirSync(racine, { withFileTypes: true })) {
    if (!entree.isDirectory() || DOSSIERS_HORS_JEUX.has(entree.name)) continue;

    const dossierJeu = path.join(racine, entree.name);
    const index = [
      path.join(dossierJeu, "v1", "index.html"),
      path.join(dossierJeu, "index.html"),
    ].find((p) => fs.existsSync(p));
    if (!index) continue;

    const html = fs.readFileSync(index, "utf8");
    const charges = [];
    for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
      const src = m[1];
      if (/^(https?:)?\/\//.test(src) || src.startsWith("/")) continue;
      charges.push(path.resolve(path.dirname(index), src));
    }
    const chargesCles = new Set(charges.map(cle));
    const jeu = relatif(racine, index);

    // 3. Usages dans chaque script chargé (jeu ET core), hors vendor (Phaser).
    for (const script of charges) {
      if (script.split(path.sep).includes("vendor")) continue;
      if (!fs.existsSync(script)) continue;

      const code = nettoyer(fs.readFileSync(script, "utf8"));
      for (const nom of usagesArcadeUI(code)) {
        const defs = definisPar.get(nom);
        if (!defs) continue; // pas défini par core/ : hors périmètre

        const defChargee = defs.some((d) => chargesCles.has(cle(path.join(racine, d))));
        if (!defChargee) {
          erreurs.push(
            `${jeu} : ${relatif(racine, script)} utilise Arcade.UI.${nom}, ` +
              `défini dans ${defs.join(" ou ")}, absent de index.html`
          );
        }
      }
    }
  }
  return erreurs;
}

// Référence pour lister les fichiers à vérifier : l'amont, sinon origin/<branche>.
function referenceDistante(avertissements) {
  if (git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).ok) {
    return "@{u}";
  }
  const branche = git(["branch", "--show-current"]).sortie;
  if (branche && git(["rev-parse", "--verify", "--quiet", `origin/${branche}`]).ok) {
    return `origin/${branche}`;
  }
  avertissements.push("aucune référence distante trouvée : node --check ignoré");
  return null;
}

function erreursSyntaxe(avertissements) {
  const erreurs = [];
  const base = referenceDistante(avertissements);
  if (!base) return erreurs;

  const diff = git(["diff", "--name-only", "--diff-filter=d", `${base}..HEAD`]);
  if (!diff.ok) {
    avertissements.push(`git diff a échoué : ${diff.erreur}`);
    return erreurs;
  }

  for (const rel of diff.sortie.split("\n").filter((f) => f.endsWith(".js"))) {
    const abs = path.join(RACINE_DEPOT, rel);
    if (!fs.existsSync(abs)) continue;
    const r = spawnSync(process.execPath, ["--check", abs], { encoding: "utf8" });
    if (r.status !== 0) {
      erreurs.push(`${rel}\n${(r.stderr || "").trim()}`);
    }
  }
  return erreurs;
}

function lireEntree() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return null;
  }
}

function main() {
  const args = process.argv.slice(2);

  // Mode test : contrôle des dépendances seulement, sur le dossier donné.
  const iRacine = args.indexOf("--racine");
  if (iRacine >= 0) {
    const racine = path.resolve(args[iRacine + 1] || "");
    const erreurs = controleDependances(racine);
    if (erreurs.length) {
      process.stderr.write(`Dépendances core/ manquantes :\n  - ${erreurs.join("\n  - ")}\n`);
      process.exitCode = 2;
    } else {
      process.stdout.write(`Dépendances core/ : OK (${racine})\n`);
    }
    return;
  }

  // Mode hook : lecture de la commande Bash/PowerShell sur stdin.
  const entree = lireEntree();
  const commande = entree && entree.tool_input && entree.tool_input.command;
  if (typeof commande !== "string" || !/\bgit\s+push\b/.test(commande)) return;

  const avertissements = [];
  const erreurs = [
    ...erreursSyntaxe(avertissements),
    ...controleDependances(JEUX_PAR_DEFAUT),
  ];

  for (const a of avertissements) {
    process.stderr.write(`[avant-push] avertissement : ${a}\n`);
  }
  if (erreurs.length) {
    process.stderr.write(
      "Push bloqué par le garde-fou avant-push :\n  - " + erreurs.join("\n  - ") + "\n"
    );
    process.exitCode = 2;
  }
}

try {
  main();
} catch (e) {
  if (process.argv.includes("--racine")) {
    // En test, une erreur doit se voir : pas de sortie 0 trompeuse.
    process.stderr.write(`Erreur : ${e && e.message}\n`);
    process.exitCode = 1;
  } else {
    // Ne jamais bloquer le push à cause d'un bug du hook lui-même.
    process.stderr.write(`[avant-push] avertissement : erreur interne ignorée (${e && e.message})\n`);
    process.exitCode = 0;
  }
}
