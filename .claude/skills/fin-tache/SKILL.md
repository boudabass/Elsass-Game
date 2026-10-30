---
name: fin-tache
description: Clôture d'une tâche : vérifier point par point ce qui était demandé contre ce qui est fait, contrôles, doc Odoo, ETAT.md. À lancer avant de dire à John que c'est fini.
---

# Clôture de tâche

Règle : **toute preuve est une sortie réelle de CE run.** Jamais un souvenir,
jamais « ça devrait marcher ». Si on ne peut pas prouver, on écrit « Non prouvé ».

## 1. Lister ce qui était demandé

À partir du brief de l'Orchestrateur, de la demande de John, ou de la section
« En cours » d'`ETAT.md`. Une ligne par point demandé.

## 2. Tableau de vérification

| Demandé | Fait ? | Preuve |
|---|---|---|

- « Fait ? » : Oui, Non, ou Partiel.
- « Preuve » : `fichier:ligne` ou la sortie d'une commande lancée pendant ce run.

## 3. Contrôles (à lancer réellement)

- **Syntaxe** : lister les `.js` modifiés, suivis et non suivis :
  `git diff --name-only origin/dev -- '*.js'` et
  `git ls-files --others --exclude-standard -- '*.js'`.
  Lancer `node --check` sur chacun. Noter le résultat de chaque fichier.
- **Tests du jeu touché** : pour chaque fichier `public/games/<jeu>/v1/tests/*.test.js`,
  lancer `node tests/<fichier>` depuis `public/games/<jeu>/v1`. Si le jeu n'a pas
  de dossier `tests/`, l'écrire.
- **Dépendances `core/`** : `node .claude/hooks/avant-push.js --racine public/games`
  doit répondre « Dépendances core/ : OK ».

Donner la sortie utile (exit code, dernières lignes) pour chaque contrôle.

## 4. Pièges de la charte, dans le diff seulement

Chercher uniquement dans les lignes AJOUTÉES (`git diff origin/dev`, lignes `+`) :
- `fillStyle(` suivi d'une chaîne entre guillemets (il n'accepte que des nombres ;
  passer par `Arcade.UI.couleur`).
- Texte entre guillemets écrit directement dans une scène (il doit venir de
  `config.textes`).
- Bouton dessiné à la main (`Graphics` ou `add.graphics` avec `setInteractive`)
  au lieu de `Arcade.UI.bouton`.
- Taille en px qui n'est pas un plancher (13 px pour le texte, 44 px pour une cible).

Présenter chaque trouvaille comme **un avertissement à examiner**, pas comme une
erreur certaine. Donner le fichier et la ligne.

## 5. Documentation

Si le gameplay ou l'interface a changé :
- l'article PRD du jeu a-t-il été mis à jour ?
- et le 458 si `core/ui/` a été touché ?
- ont-ils été **relus en entier** ? (leçon de l'article 875)

Répondre oui ou non, pour chaque article, avec la section concernée.

## 6. Section « Non vérifié » (obligatoire)

Lister tout ce qui n'a été vu qu'en capture d'écran, ou pas vu du tout : physique
réelle, rendu sur un vrai téléphone, roulement d'un tir, son. Si la liste est vide,
écrire **« rien »**. Ne jamais omettre cette section.

## 7. Réécrire `ETAT.md`

Réécrire le fichier (jamais l'allonger, 40 lignes maximum, mêmes titres). Mettre à
jour au minimum :
- « En cours »
- « Attend le test de John »
- « Mis à jour le » (date du jour et « par l'Operateur » ou « par l'Orchestrateur »)

Si `ETAT.md` est absent, le dire et ne pas en créer un sans demande.

## 8. Verdict

Une seule ligne, parmi :
- **FINI**
- **FINI SAUF** : <liste des points restants>
- **PAS FINI** : <raison>

Donner le verdict après les sections 2 à 7, jamais avant.
