/*
 * Quilles.js — les quilles de Quilles Saint-Gall : création des sprites et de
 * leurs corps physiques, colliders boule↔quilles et quille↔quille, bascule
 * debout → tombée (comptage des quilles tombées), positionnement sur la grille
 * en losange, aspect selon l'état (couleur ou forme), frottement des quilles
 * qui glissent.
 *
 * Extrait de GameScene.js le 07/11/2026 — DÉPLACEMENT DE CODE PUR, aucun
 * changement de comportement (mêmes formules, même ordre des opérations).
 * Les callbacks de collision sont définis ici : `this` y désigne bien cet
 * objet, et la scène est `scene` (variable locale, comme dans Visee.js).
 *
 * Ne possède PAS la géométrie de la piste (`scene.pisteLargeur`,
 * `scene.pisteOffsetX`, `scene.ligneLancerPiste`, `scene.pxParCm`, calculés
 * dans GameScene._recalculerGeometrie) ni le score : les points passent par
 * `scene.regles` (Regles.js). Les DONNÉES restent des propriétés de la scène
 * (`scene.quilles`, `scene.numerosQuille`, `scene.quillesGroup`,
 * `scene.rayonQuille`, `scene.quilleHauteurTombeePx`…), lues ou écrites ici.
 * BandesLaterales.js appelle aussi _corrigerRebondMur, _rendreQuilleMobile et
 * _toucherQuille, via `scene.quillesSys`.
 */

class Quilles {
    /** @param {Phaser.Scene} scene la GameScene propriétaire */
    constructor(scene) {
        this.scene = scene;
    }

    _creerQuilles() {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        scene.quilles = [];
        scene.numerosQuille = [];
        scene.quillesGroup = scene.physics.add.group();

        for (let i = 0; i < 9; i++) {
            const q = scene.physics.add.sprite(0, 0, "quille").setDepth(4);
            q.body.setAllowGravity(false);
            // Rayon LOCAL = moitié de la texture "quille" (32×32, cf.
            // genererTextures) × le facteur de config — le corps Arcade
            // suit ensuite tout seul l'échelle du sprite (`_sx`, dérivée de
            // `setDisplaySize`) : tant que la LARGEUR affichée reste
            // `this.rayonQuille * 2` (vrai debout ET tombée, cf.
            // _appliquerEtatQuille/_toucherQuille — seule la HAUTEUR
            // s'étire), le rayon de collision reste PILE `this.rayonQuille`
            // dans les 2 états, sans recalcul à chaque frame/resize.
            q.body.setCircle(16 * C.quille.rayonCollisionFacteur);
            q.setData("index", i);
            q.setData("debout", true);
            q.setData("absente", false);
            scene.quilles.push(q);
            scene.quillesGroup.add(q);

            // Numéro (1-9) affiché UNIQUEMENT pendant les jets à ordre
            // imposé (D/E) — indispensable pour que le joueur sache quelle
            // quille est laquelle (le PRD §6 ne prévoyait cette
            // numérotation que comme référence interne à config.js).
            const num = Arcade.UI.text(scene, 0, 0, String(i + 1), 2.4, C.couleurs.texteSombre)
                .setDepth(5).setVisible(false);
            scene.numerosQuille.push(num);
        }
    }

    /**
     * Colliders Arcade Physics boule↔quilles et quille↔quille (refonte
     * masse réelle du 31/08, cf. commentaire d'en-tête de la classe). Les
     * `processCallback` tournent AVANT que Phaser ne calcule la séparation/
     * l'échange de vitesse : c'est là qu'on décide si une quille encore
     * debout (`body.immovable = true`, cf. _positionnerQuilles) tombe ou
     * reste un mur — si elle tombe, on la rend mobile AVANT de laisser
     * Phaser résoudre le choc (_rendreQuilleMobile), pour que l'échange de
     * quantité de mouvement de CE MÊME contact utilise déjà sa vraie masse.
     * Retourne toujours `true` : la séparation/le rebond doivent de toute
     * façon avoir lieu (mur immobile OU quille désormais mobile).
     */
    _creerColliders() {
        const scene = this.scene;
        scene.physics.add.collider(
            scene.boule, scene.quillesGroup,
            (boule, quille) => this._corrigerRebondMur(boule, quille),
            (boule, quille) => this._processCollisionBouleQuille(boule, quille),
            scene
        );
        scene.physics.add.collider(
            scene.quillesGroup, scene.quillesGroup,
            (a, b) => { this._corrigerRebondMur(a, b); this._corrigerRebondMur(b, a); },
            (a, b) => this._processCollisionQuilleQuille(a, b),
            scene
        );
        // Bandes latérales (PRD 875 §12) : colliders boule/quilles↔bandes
        // délégués à BandesLaterales.creerColliders() — même ordre relatif
        // d'enregistrement qu'avant l'extraction (boule↔bande PUIS
        // quille↔bande). this._corrigerRebondMur (générique, partagé avec
        // boule↔quille/quille↔quille) reste ici, rappelé en retour.
        scene.bandes.creerColliders();
    }

    /**
     * Décide si `quille` (encore debout, donc `body.immovable`) tombe sous
     * le choc de la boule — même seuil que l'ancien modèle
     * (`boule.vitesseMinRenversePct`). Si oui : bookkeeping du score
     * (_toucherQuille) + bascule en corps mobile massique
     * (_rendreQuilleMobile) AVANT que Phaser ne résolve le contact. Sinon,
     * la quille reste un mur : cf. _corrigerRebondMur (collideCallback,
     * après résolution) pour ce qui se passe alors.
     */
    _processCollisionBouleQuille(boule, quille) {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        if (quille.getData("debout")) {
            const seuil = (C.boule.vitesseMinRenversePct / 100) * scene.h;
            if (boule.body.speed >= seuil) {
                this._toucherQuille(quille, boule.body.velocity.x, boule.body.velocity.y);
                this._rendreQuilleMobile(quille);
            }
        }
        boule.setData("dejaTouche", true);
        return true;
    }

    /**
     * Même principe côté quille↔quille (ricochet — une quille qui glisse
     * après avoir été renversée peut à son tour en renverser une autre
     * encore debout, règle fédérale des jets 12/16, cf. l'historique de ce
     * fichier). `a`/`b` peuvent arriver dans n'importe quel ordre — on
     * teste les 2 sens. Si aucune des deux n'est un mur debout (2 quilles
     * déjà tombées qui se percutent), Phaser résout directement l'échange
     * de vitesse par les masses réelles, sans logique dédiée.
     */
    _processCollisionQuilleQuille(a, b) {
        this._essayerRenverserParContact(a, b);
        this._essayerRenverserParContact(b, a);
        return true;
    }

    /**
     * Corrige un défaut du moteur (trouvé le 01/09, demande John : « la
     * quille arrive quand même à arrêter net la boule ») : quand une
     * quille reste un mur (`body.immovable`, elle n'a pas basculé sur CE
     * choc), la formule d'impulsion d'Arcade Physics pour un corps
     * immobile reste basée sur sa masse RÉELLE (finie, 2,8kg) au lieu de
     * la traiter comme infiniment lourde — pour une quille bien plus
     * légère que la boule, ça ne la repousse presque pas : elle continue
     * de foncer vers le mur, le repercute dès la frame suivante, et
     * s'arrête net en une quinzaine de frames à force de freinages
     * répétés (vérifié chiffré : vitesse d'impact 55 → 42,8 après UNE
     * résolution native, mais la boule continue toujours d'AVANCER vers
     * la quille au lieu d'être repoussée). Corrigé ici en recalculant
     * nous-mêmes une vraie réflexion sur la normale de contact
     * (v' = v - 2(v·n)n, un vrai rebond de mur), à la place du résultat
     * natif — mais SEULEMENT si le corps `mobile` s'apprêtait encore à
     * foncer DANS le mur après résolution (`vN < 0`) : sur une quille qui
     * tombe (mobile ↔ mobile) ou un contact déjà en train de s'écarter,
     * on ne touche à rien, la conservation de quantité de mouvement de
     * Phaser reste seule maîtresse (elle, elle fonctionne bien).
     */
    _corrigerRebondMur(mobile, mur) {
        if (mobile.body.immovable || !mur.body.immovable) return;
        const dx = mobile.x - mur.x, dy = mobile.y - mur.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.001) return;
        const nx = dx / dist, ny = dy / dist;
        const v = mobile.body.velocity;
        const vN = v.x * nx + v.y * ny;
        if (vN >= 0) return;   // s'éloigne déjà du mur, rien à corriger
        const bounce = mobile.body.bounce.y;
        mobile.body.setVelocity(
            (v.x - 2 * vN * nx) * bounce,
            (v.y - 2 * vN * ny) * bounce
        );
    }

    /** `cible` tombe-t-elle sous le choc de `source` ? (cf. _processCollisionQuilleQuille) */
    _essayerRenverserParContact(cible, source) {
        const scene = this.scene;
        if (cible === source || !cible.getData("debout") || !cible.body.immovable) return;
        const C = window.QuillesSaintGallConfig;
        const seuil = (C.quille.vitesseMinRenverseAutreQuillePct / 100) * scene.h;
        if (source.body.speed >= seuil) {
            this._toucherQuille(cible, source.body.velocity.x, source.body.velocity.y);
            this._rendreQuilleMobile(cible);
        }
    }

    /** Bascule une quille de "mur immobile" à "corps mobile massique" au moment où elle tombe. */
    _rendreQuilleMobile(q) {
        const C = window.QuillesSaintGallConfig;
        q.body.setImmovable(false);
        q.body.mass = C.quille.masseKg;
        q.body.setBounce(C.quille.bounce);
    }

    /**
     * Losange (quinconce 1-2-3-2-1), PAS un carré 3×3 — corrigé le
     * 30/08/2026 (soir) d'après le vrai schéma fédéral (article 780,
     * cf. en-tête de config.js). `POSITIONS[i]` donne, pour chaque indice
     * de quille (0-8, fond → avant), sa rangée (0=fond … 4=pointe avant)
     * et son décalage horizontal en fraction de la demi-largeur
     * de la rangée du milieu (la plus large, 3 quilles) — modèle "grille
     * 3×3 tournée à 45°" (rangées de 2 à mi-écart de la rangée de 3).
     */
    _positionnerQuilles() {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        const UI = Arcade.UI;
        // Grille FIXE 5×5, CARRÉE — refonte du 31/08 (dernière passe,
        // demande John : "peu importe l'espace que cela prend sur la
        // piste, la grille doit être carrée 1/1"). Largeur ET hauteur de
        // la grille = grilleLargeurPct % de pisteLargeur UNIQUEMENT (60%
        // par défaut) : les 2 dimensions suivent la MÊME base (la largeur
        // de piste), donc un vrai carré peu importe le format d'écran —
        // remplace l'ancien calcul qui dérivait la hauteur en % de LA
        // HAUTEUR de piste (this.ligneLancerY, une échelle différente),
        // ce qui écrasait le losange près du bord haut sur certains
        // formats.
        const grilleTaillePx = scene.pisteLargeur * (C.piste.grilleLargeurPct / 100);
        const centreX = scene.pisteOffsetX + scene.pisteLargeur / 2;
        // Ancrage : marge FIXE en haut de la piste (% de LA HAUTEUR de
        // piste — volontairement la seule valeur ici liée à cette
        // échelle-là, cf. commentaire de piste.grilleHautYPct en config).
        // this.ligneLancerPiste (PAS this.ligneLancerY) : référence SANS
        // la rallonge (31/08, passe suivante) — les quilles ne doivent
        // jamais bouger quand la rallonge apparaît/change de taille.
        const grilleHautY = (C.piste.grilleHautYPct / 100) * scene.ligneLancerPiste;

        const nbCases = C.piste.grilleCases;   // 5
        const tailleCase = grilleTaillePx / nbCases;   // 12% de pisteLargeur si grilleLargeurPct=60
        // Les quilles sont posées au CENTRE de leur case (demande John) —
        // col/row 0-4 (POSITIONS ci-dessous). Pas de quille physiquement
        // plus grosse ni de position fixe spéciale : « le Roi » = la
        // quille prépondérante DU JET EN COURS, indice propre à chaque
        // jet (cf. config.jets et en-tête de config.js, 5e passe 31/08).
        const colToX = (col) => centreX + (col - (nbCases - 1) / 2) * tailleCase;
        const rowToY = (row) => grilleHautY + (row + 0.5) * tailleCase;

        // Quinconce 1-2-3-2-1 (losange), désormais exprimé en cases
        // entières (col, row) de la grille 5×5 — mêmes emplacements
        // relatifs qu'avant (dx -1/-0.5/0/0.5/1 sur 5 rangées).
        const POSITIONS = [
            { row: 0, col: 2 },
            { row: 1, col: 1 }, { row: 1, col: 3 },
            { row: 2, col: 0 }, { row: 2, col: 2 }, { row: 2, col: 4 },
            { row: 3, col: 1 }, { row: 3, col: 3 },
            { row: 4, col: 2 }
        ];

        // Rayon RÉEL (diamètre en cm × this.pxParCm), demande John 31/08 —
        // remplace l'ancien % du plus petit côté de l'écran (UI.u), sans
        // lien avec l'échelle de la piste. Les 9 quilles ont TOUTES le même
        // rayon (pas de quille physiquement plus grosse — cf. en-tête de
        // config.js, 5e passe du 31/08 : « le Roi » = la quille prépondérante
        // du jet en cours, pas une quille distincte).
        scene.rayonQuille = scene.pxParCm * (C.quille.diametreCm / 2);
        // Longueur du rectangle d'une quille TOMBÉE (couchée au sol) —
        // hauteur RÉELLE de la quille (42cm = 21% de la largeur de piste),
        // PAS un rayon (demande John 31/08). Largeur du rectangle = même
        // diamètre que la quille debout (rayonQuille × 2).
        scene.quilleHauteurTombeePx = scene.pxParCm * C.quille.hauteurCm;

        const showNumeros = scene.jetConfig && scene.jetConfig.type === "ordre";

        scene.quilles.forEach((q, i) => {
            const pos = POSITIONS[i];
            const x = colToX(pos.col);
            const y = rowToY(pos.row);

            q.setPosition(x, y);
            // Taille d'affichage définie dans _appliquerEtatQuille (cercle
            // si debout, rectangle allongé si tombée) ; le rayon de
            // collision suit tout seul via body.setCircle (cf. _creerQuilles).
            q.body.updateFromGameObject();
            q.body.setVelocity(0, 0);

            // Corps physique : absente = désactivé (jamais collisionnable) ;
            // debout = mur immobile (masse "infinie", cf. _rendreQuilleMobile
            // qui le bascule mobile SEULEMENT si elle tombe) ; déjà tombée
            // (phases D/E persistantes, cf. _demarrerJet) = corps mobile,
            // au repos, avec sa vraie masse — peut encore être bousculée.
            const debout = q.getData("debout");
            const absente = q.getData("absente");
            q.body.enable = !absente;
            q.body.setImmovable(debout);
            q.body.mass = C.quille.masseKg;
            q.body.setBounce(C.quille.bounce);

            this._appliquerEtatQuille(q);

            const num = scene.numerosQuille[i];
            num.setPosition(x, y).setFontSize(Math.round(UI.u(scene, 2.4)) + "px");
            // Numéro crème sur la quille à viser (lisible sur le rouge), sombre ailleurs.
            num.setColor(i === scene.regles._indexQuilleAViser() ? C.couleurs.texte : C.couleurs.texteSombre);
            num.setVisible(showNumeros && q.getData("debout"));
        });
    }

    /**
     * `absente` (PRD §7 phase C) : la quille n'est PAS présente sur la
     * piste pour ce jet (hors figure) — entièrement invisible, jamais
     * collisionnable (elle reste `debout=false`, déjà exclue par
     * _suivreBoule).
     *
     * Reproduit le panneau lumineux du vrai jeu (demande John, 31/08) —
     * les 9 quilles réelles sont TOUTES identiques, seul l'affichage les
     * distingue, à 3 états : RIEN (absente, rien à l'écran) / JAUNE
     * (debout, en place) / ROUGE (debout ET à viser : prépondérante ou cible du jet en
     * cours — remplace l'ancien anneau doré séparé, la couleur de la
     * quille porte directement l'info). Une quille TOMBÉE reste BLANCHE
     * mais change de FORME (rectangle = couchée au sol, texture
     * "quilleTombee" générée dans genererTextures) plutôt que de
     * couleur — distincte d'une quille absente (invisible).
     */
    _appliquerEtatQuille(q) {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        if (q.getData("absente")) {
            q.setVisible(false);
            return;
        }
        q.setVisible(true);
        q.setAlpha(1);
        const debout = q.getData("debout");
        if (!debout) {
            q.setTexture("quilleTombee");
            q.setTint(0xffffff);
            // Rectangle : diamètre (6% piste, largeur) × hauteur réelle de
            // la quille (21% piste, longueur) — PAS un carré, cf.
            // this.quilleHauteurTombeePx (demande John 31/08).
            q.setDisplaySize(scene.rayonQuille * 2, scene.quilleHauteurTombeePx);
            return;
        }
        q.setTexture("quille");
        q.setDisplaySize(scene.rayonQuille * 2, scene.rayonQuille * 2);
        const estAViser = q.getData("index") === scene.regles._indexQuilleAViser();
        q.setTint(Phaser.Display.Color.HexStringToColor(
            estAViser ? C.couleurs.quillePreponderante : C.couleurs.quilleEnPlace
        ).color);
    }

    /**
     * `dirX`/`dirY` : direction du choc qui fait tomber cette quille (la
     * vitesse de la boule à l'impact, ou celle de la quille source pour
     * un ricochet en chaîne) — demande John, 31/08 : "il faut que la
     * quille tombe dans sa direction, pas tous vers le haut". Optionnel,
     * défaut (0,1) = ancien comportement (toujours à la verticale) si
     * appelé sans direction connue.
     */
    _toucherQuille(quille, dirX = 0, dirY = 1) {
        const scene = this.scene;
        if (!quille.getData("debout")) return;
        quille.setData("debout", false);
        scene.quillesTombeesCount++;
        if (quille.getData("index") === scene.regles._indexPrependeranteDuJet()) scene.prependeranteTombee = true;

        // Horodatage de la chute (frame courant) — utilisé par
        // _calculerOrdreJet pour vérifier l'ordre imposé et détecter les
        // chutes simultanées (phases D/E uniquement, inoffensif sinon).
        scene.ordreChute.push({ index: quille.getData("index"), frame: scene.frameId });
        scene.numerosQuille[quille.getData("index")].setVisible(false);

        // Oriente la quille pour que son axe long (la hauteur qui va
        // s'étirer ci-dessous) s'aligne avec la direction du choc, plutôt
        // que de toujours pointer vers le haut de l'écran. Le repère local
        // non tourné a son axe long vertical (0, r) ; après rotation par
        // θ, ce point va en (-r·sinθ, r·cosθ) — poser θ = atan2(-dirX, dirY)
        // aligne donc cet axe sur (dirX, dirY).
        const norme = Math.hypot(dirX, dirY);
        if (norme > 0.0001) {
            quille.setRotation(Math.atan2(-dirX / norme, dirY / norme));
        }

        // Animation « le rond s'allonge » (demande John, 31/08) : reste
        // sur la texture CERCLE ("quille") et étire uniquement la HAUTEUR
        // d'affichage jusqu'à la taille cible du rectangle (largeur
        // JAMAIS touchée, jamais de rétrécissement) — visuellement, le
        // cercle s'étire en ovale dans la direction du choc. Bascule vers
        // la texture rectangle aux contours nets ("quilleTombee")
        // seulement une fois la taille cible atteinte, cf.
        // _appliquerEtatQuille pour l'état final (utilisé aussi par
        // _positionnerQuilles au redimensionnement, sans animation dans
        // ce cas-là — la rotation y est laissée telle quelle).
        quille.setTexture("quille");
        quille.setTint(0xffffff);
        quille.setDisplaySize(scene.rayonQuille * 2, scene.rayonQuille * 2);
        scene.tweens.add({
            targets: quille,
            displayHeight: scene.quilleHauteurTombeePx,
            duration: 220,
            ease: "Quad.easeOut",
            onComplete: () => {
                if (quille.getData("debout")) return; // resize entre-temps
                quille.setTexture("quilleTombee");
                quille.setTint(0xffffff);
            }
        });
    }

    /**
     * Ralentit (jusqu'à l'arrêt) les quilles devenues des corps mobiles
     * (renversées, cf. _rendreQuilleMobile) — les quilles encore debout
     * (`body.immovable`) ou absentes (`body.enable = false`) sont ignorées.
     * Le déplacement lui-même (intégration de la vitesse) et les
     * collisions quille↔quille sont gérés par Arcade Physics, cf.
     * _creerColliders ; cette méthode n'applique QUE le frottement.
     */
    _amortirQuillesMobiles(dt) {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        const amorti = Math.max(0, 1 - C.quille.frictionGlissementPar_s * dt);
        scene.quilles.forEach((q) => {
            if (!q.body.enable || q.body.immovable) return;
            const v = q.body.velocity;
            if (v.x === 0 && v.y === 0) return;
            let nvx = v.x * amorti, nvy = v.y * amorti;
            if (Math.hypot(nvx, nvy) < 2) { nvx = 0; nvy = 0; }
            q.body.setVelocity(nvx, nvy);
        });
    }
}
