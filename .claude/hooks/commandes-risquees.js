// PreToolUse (matcher Bash|PowerShell) — demande confirmation avant les
// commandes git risquées : push forcé, reset --hard, clean -f, tag, merge sur
// main, push vers main.
//
// Ne bloque pas : répond « ask » sur stdout, pour que John valide lui-même.
// Commande sans risque → exit 0 sans rien écrire.
"use strict";

const fs = require("fs");
const { spawnSync } = require("child_process");

function brancheCourante() {
  const r = spawnSync("git", ["branch", "--show-current"], { encoding: "utf8" });
  return r.status === 0 ? (r.stdout || "").trim() : "";
}

// Découpe une ligne de commande en segments séparés par && || ; | ou retour à la ligne.
function segments(commande) {
  return commande.split(/&&|\|\||;|\||\n/).map((s) => s.trim()).filter(Boolean);
}

// Renvoie les raisons de demander confirmation pour un segment (vide = rien).
function raisonsSegment(seg, branche) {
  const raisons = [];

  const push = seg.match(/\bgit\s+push(?![\w-])(.*)$/);
  if (push) {
    const args = push[1].trim().split(/\s+/).filter(Boolean);
    const options = args.filter((a) => a.startsWith("-"));
    const refs = args.filter((a) => !a.startsWith("-"));

    const forcePush =
      options.some((o) => o.startsWith("--force") || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(o)) ||
      refs.some((r) => r.startsWith("+"));
    if (forcePush) {
      raisons.push("Push forcé : il réécrit l'historique distant. Confirmer avec John avant d'envoyer.");
    }

    // refs[0] = distant (origin), refs[1..] = refspecs.
    const specs = refs.slice(1);
    let versMain;
    if (specs.length === 0) {
      // Pas de refspec : git pousse la branche courante vers son homonyme.
      versMain = branche === "main";
    } else {
      versMain = specs.some((r) => {
        const dest = r.replace(/^\+/, "").split(":").pop();
        return dest === "main" || dest === "refs/heads/main" || (dest === "HEAD" && branche === "main");
      });
    }
    if (versMain) {
      raisons.push("Push vers main : mise en production. John a-t-il dit explicitement release ?");
    }
  }

  if (/\bgit\s+reset(?![\w-])(?=.*--hard\b)/.test(seg)) {
    raisons.push("git reset --hard efface définitivement les modifications non commitées. Confirmer ?");
  }

  if (/\bgit\s+clean(?![\w-])(?=.*(--force\b|\s-[a-zA-Z]*f))/.test(seg)) {
    raisons.push("git clean -f supprime définitivement des fichiers non suivis. Confirmer ?");
  }

  if (/\bgit\s+tag(?![\w-])/.test(seg)) {
    raisons.push("Pose ou modification d'un tag : John a-t-il dit explicitement release ?");
  }

  if (/\bgit\s+merge(?![\w-])/.test(seg) && branche === "main") {
    raisons.push("Merge sur main = mise en production : John a-t-il dit explicitement release ?");
  }

  return raisons;
}

function main() {
  let entree;
  try {
    entree = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return;
  }
  const commande = entree && entree.tool_input && entree.tool_input.command;
  if (typeof commande !== "string" || !/\bgit\b/.test(commande)) return;

  const branche = brancheCourante();
  const raisons = [];
  for (const seg of segments(commande)) {
    for (const r of raisonsSegment(seg, branche)) {
      if (!raisons.includes(r)) raisons.push(r);
    }
  }
  if (!raisons.length) return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: raisons.join(" ; "),
      },
    })
  );
}

try {
  main();
  process.exitCode = 0;
} catch (e) {
  // Un bug de ce hook ne doit jamais bloquer ni autoriser une commande à tort.
  process.stderr.write(`[commandes-risquees] avertissement : erreur interne ignorée (${e && e.message})\n`);
  process.exitCode = 0;
}
