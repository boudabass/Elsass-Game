---
name: fiche-test
description: Fiche de test pour John sur elsass-game-dev : quoi tester avant une release, puis tri de ses retours.
disable-model-invocation: false
---

# Fiche de test pour John

Argument : `avant` (par défaut) ou `apres`.

Langage : français simple, sans jargon. Pas de mots comme « commit », « core »,
« plancher », « hook ». Parler de « l'écran », « le bouton rouge », « le menu ».

## Mode `avant` : préparer la fiche

1. Mettre à jour la référence : `git fetch origin`.
2. Lister les commits à tester :
   `git log --format='%h %s' origin/main..origin/dev`.
   Si John donne un commit ou un jeu en argument, ne garder que ceux-là.
3. Écarter les commits d'outillage : ceux qui ne touchent que `.claude/` ou des
   fichiers `.md` (`git show --stat --format= <hash>`). Rien à tester côté joueur.
4. Pour chaque commit restant, lire ce qui a changé côté joueur :
   `git show <hash>` sur les fichiers `config.js`, `scenes/` et `core/ui/`.
   Un changement dans `core/` touche TOUS les jeux : le noter pour chacun.
5. Écrire la fiche : **10 points maximum**, groupés par jeu. Chaque point contient :
   - **Où aller** : l'adresse de dev (elle est dans `CLAUDE.md`, section
     Déploiement), le jeu, l'écran.
   - **Quoi faire** : les gestes précis (taper, glisser, tourner le téléphone).
   - **Ce qui doit se passer** : le résultat attendu, en une phrase.
   - **Formats** : téléphone debout, téléphone couché, ordinateur (ceux qui comptent).
6. Mettre EN PREMIER les points jamais vérifiés par un humain : lire la section
   « Attend le test de John » d'`ETAT.md`. Si ce fichier est absent, le dire et
   s'appuyer seulement sur les commits.
7. Afficher la fiche dans la conversation. **Ne rien écrire sur le disque.**

## Mode `apres` : trier les retours

1. John colle ses retours. Pour chaque point de la fiche, classer :
   - **OK** : John dit clairement que ça marche.
   - **PROBLÈME** : une ligne qui décrit ce qui ne va pas.
   - **PAS TESTÉ** : John n'a rien dit, ou a dit qu'il n'a pas eu le temps.
   **Un silence n'est jamais un OK.**
2. Réécrire la section « Attend le test de John » d'`ETAT.md` :
   - retirer les points OK ;
   - garder les points PAS TESTÉ ;
   - ajouter les PROBLÈMES dans « Prochaines étapes » ;
   - mettre à jour « Mis à jour le ».
   Le fichier reste à 40 lignes maximum, avec les mêmes titres.
3. Conclure par une ligne : « Prêt pour release : oui » ou « non », avec la
   raison en une phrase (un problème ouvert, ou un point non testé).
   Rappeler que la mise en prod attend le mot « release » de John.

Ne jamais toucher à `main`, ne poser aucun tag, ne modifier aucun fichier de jeu.
