---
name: petite-modif
description: Petite modification de gameplay ou d'interface (réglage chiffré, retouche, petit ajout) : classer, écrire la règle dans la PRD Odoo AVANT de coder.
disable-model-invocation: false
---

# Petite modification

Règle d'or : **la règle est écrite dans l'article PRD du jeu AVANT de coder.**

## 1. Classer la demande

Choisir UNE catégorie :
- **RÉGLAGE** : changer un chiffre (vitesse, durée, prix, taille).
- **RETOUCHE** : petit changement de comportement dans un écran ou une règle.
- **AJOUT** : 1 ou 2 nouveaux états (un message, un bouton de plus).
- **TROP GROS** : nouveau système, plusieurs jeux touchés, ou `core/` touché.

Si **TROP GROS** : stop. Dire à John pourquoi, en une phrase, et ne rien faire
d'autre. Ce genre de chantier passe par un brief de l'Orchestrateur.

## 2. Repérer les clés de `config.js`

- Ouvrir `public/games/<jeu>/v1/config.js` et repérer la ou les clés
  concernées, avec leur valeur actuelle.
- Rappel : **aucune valeur chiffrée et aucun texte en dur dans une scène.**
  Les chiffres vont dans `config.js`, le texte dans `config.textes`.

## 3. Lire l'article PRD du jeu

Correspondance jeu → article Odoo :
- schieweschlawe : 873
- quillessaintgall : 875 (règles 780 et 877)
- similitude : 473 et 728
- elsass-farm : 434 (roadmap, contient le Bloc B)
- Si la demande touche `core/ui/` : l'article 458 aussi.

**Cigogne et Waggis n'ont pas d'article PRD dédié.** Le dire à John et ne rien
inventer : demander comment il veut noter la règle.

Lire l'article **en entier** (outils Odoo `get_record` ou `search_records`, modèle
`knowledge.article`). Repérer la section concernée.

## 4. Demander l'accord de John

Utiliser AskUserQuestion avec un résumé en 3 lignes, valeurs exactes :
- **Avant** : la valeur ou le comportement actuel.
- **Après** : la nouvelle valeur ou le nouveau comportement.
- **Pourquoi** : une phrase.

Options : « Oui, je code » / « Non, je ne fais rien » / « Autre chose ».

**Sans « oui » explicite de John : stop. Ne rien coder.**

## 5. Écrire la règle dans la PRD, AVANT de coder

Une fois le « oui » de John reçu, et seulement alors :
- mettre à jour la section concernée de l'article PRD avec la nouvelle règle
  (valeur exacte, nouveau comportement), avec l'outil Odoo `update_record` sur
  `knowledge.article` ;
- ne jamais écrire « cf. mémoire » ou « voir la mémoire du studio » : John doit
  pouvoir lire l'article seul.

## 6. Coder

- Faire la modification : dans `config.js` pour un réglage, dans la scène pour
  une retouche (en passant toujours par la config).
- Rester strictement dans ce que la règle écrite en §5 décrit.

## 7. Relire l'article ENTIER, puis corriger

- Après le code, relire **l'article entier**, pas seulement la section changée.
- Vérifier qu'aucune autre section n'est devenue fausse (leçon de l'article 875).
  Corriger ce qui l'est.

## 8. Terminer

Dire à John : **« Lance /fin-tache avant de dire que c'est fini. »**
