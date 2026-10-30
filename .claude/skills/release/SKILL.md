---
name: release
description: Mise en production Elsass-Game (dev → main + tag vX.Y.Z). Réservée à John, ne se déclenche jamais toute seule.
disable-model-invocation: true
---

# Release Elsass-Game

Met `dev` en production : merge `dev` dans `main` (`--no-ff`) puis tag annoté
`vX.Y.Z`, et pousse `main` + le tag. Chaque étape **s'arrête au premier échec**.
Ne jamais forcer, ne jamais contourner un contrôle.

Les hooks `commandes-risquees` demanderont confirmation pour le merge sur
`main`, le tag et le push vers `main`. C'est attendu : ne valider qu'après le
oui explicite de l'étape 2.

## 1. Vérifier l'état du dépôt

- La branche courante est `dev` (`git branch --show-current`).
- Le working tree est propre (`git status --porcelain` ne renvoie rien).
- `dev` est à jour avec `origin` :
  `git fetch origin` puis `git rev-parse dev` = `git rev-parse origin/dev`.

Si l'un des trois n'est pas vrai : **stop**, expliquer lequel et ce qu'il faut faire
(commit, push ou pull). Ne pas tenter de réparer seul.

## 2. Demander à John la confirmation explicite

Calculer le numéro proposé : dernier tag (`git describe --tags --abbrev=0`) avec
le mineur incrémenté (v0.11.0 → v0.12.0). Puis demander via AskUserQuestion :

> As-tu testé sur elsass-game-dev et valides-tu la mise en prod de vX.Y.Z ?

Options : « Oui, mettre en prod vX.Y.Z » (recommandée) / « Non, pas encore » /
« Autre numéro ». John peut donner un autre numéro.

**Seul un « oui » explicite fait continuer.** Tout le reste, y compris un silence
ou un « ok » ambigu : **stop**, sans toucher à `main`.

## 3. Contrôles avant merge

Lancer depuis la racine du dépôt, sur `dev` :

1. Syntaxe de tous les JS suivis de `public/games` (hors `vendor`) :
   ```bash
   set -e
   while IFS= read -r f; do node --check "$f"; done < <(git ls-files 'public/games/*.js' | grep -v '/vendor/')
   ```
2. Typage : `pnpm exec tsc --noEmit`
3. Tests Node existants, chacun lancé depuis son dossier `v1` :
   ```bash
   set -e
   for t in public/games/*/v1/tests/*.test.js; do
     (cd "$(dirname "$t")/.." && node "tests/$(basename "$t")")
   done
   ```

Si un contrôle échoue : **stop**, montrer la sortie réelle à John, ne pas continuer.

## 4. Écrire le message de merge et de tag

Lister les commits à livrer : `git log --oneline main..dev`.

Écrire le message dans un fichier du dossier scratchpad de la session (chemin
donné dans l'environnement), par exemple `message-release-vX.Y.Z.txt` :

- Première ligne : `Release vX.Y.Z`.
- Ligne vide, puis un résumé en français : un point par commit de `main..dev`,
  avec son hash court et son titre.

**Jamais de message passé par stdin ou `-F -`** : c'est l'incident v0.10.0
(le tag est parti sur le mauvais commit). Toujours un fichier.

## 5. Merge, tag, push (script strict)

Remplacer `vX.Y.Z` et `<FICHIER_MESSAGE>` par les valeurs validées. Lancer
d'un seul bloc, `set -e` actif :

```bash
set -e
git checkout main
git pull --ff-only origin main
if [ "$(git branch --show-current)" != "main" ]; then echo "Pas sur main : arrêt"; exit 1; fi
git merge --no-ff dev -F "<FICHIER_MESSAGE>"
git tag -a "vX.Y.Z" -F "<FICHIER_MESSAGE>"
if [ "$(git rev-list -n1 vX.Y.Z)" != "$(git rev-parse HEAD)" ]; then echo "Le tag ne pointe pas sur le merge : arrêt"; exit 1; fi
git push origin main
git push origin vX.Y.Z
git checkout dev
```

En cas d'échec à mi-parcours : ne rien forcer. Dire à John où l'on en est
(`git status`), et si un merge est resté en conflit, proposer `git merge --abort`
après accord. Si le tag a été posé sur un mauvais commit, le supprimer (local et
origin) seulement avec l'accord de John.

## 6. Rappel final (à faire ensuite, pas automatique)

- Mettre à jour l'article Odoo **406** (faits saillants : version et nouveautés).
- Mettre à jour l'article Odoo **425** (périmètre des jeux) si un jeu a changé d'état.
- Noter la release dans `CLAUDE.md` (fichier local gitignoré, pas versionné) :
  version, date, contenu, et ce qui reste à faire.

Annoncer à John la version mise en prod, le hash du commit de merge et le lien
vers le tag.
