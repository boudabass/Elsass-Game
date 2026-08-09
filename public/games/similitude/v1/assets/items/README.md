# Items de Similitude — SUBSTITUTS TEMPORAIRES

Les 6 fichiers PNG de ce dossier portent déjà leur **nom définitif**. Ce sont
pour l'instant des **substituts** : des sprites Kenney (16×16, licence CC0)
piochés dans les packs déjà triés, en attendant les dessins de John.

| Fichier | Sujet final | Substitut actuel (origine Kenney) | Couleur dominante |
|---|---|---|---|
| `bretzel.png`    | bretzel          | `farm_pain` (petit pain rond)        | doré |
| `cigogne.png`    | cigogne          | `farm_poule`                         | blanc + rouge |
| `kougelhopf.png` | kougelhopf       | `rogrpg_tourte` (tourte en assiette) | blanc + orange |
| `chope.png`      | chope de bière   | `rogrpg_tonneau_v1`                  | marron |
| `choucroute.png` | choucroute       | `farm_chou_icone`                    | vert |
| `geranium.png`   | géranium         | `rogrpg_fleur_exotique_rouge`        | rouge |

## Remplacement par les vrais dessins

Il suffit d'**écraser le fichier** par le dessin définitif, en gardant le même
nom. Aucune ligne de code à toucher : les chemins sont listés une seule fois,
dans `config.js`.

Contraintes à respecter pour les dessins :

- **carré**, fond transparent ;
- **16×16 px** de préférence (pixel art, comme les substituts). Si les dessins
  sont plus grands, ils doivent tous faire la **même taille** entre eux, et il
  faudra passer `pixelArt: false` dans `Arcade.boot` pour éviter l'effet
  d'escalier ;
- **silhouette lisible en tout petit** : une case fait environ 9 % du plus petit
  côté de l'écran, soit ~35 px sur un téléphone. C'est un jeu où l'on compare
  81 vignettes d'un coup d'œil ;
- **une couleur dominante par item**, bien distincte des 5 autres — c'est la
  couleur, avant la forme, qui permet de repérer un alignement.

Spec du jeu : article Odoo 473.
