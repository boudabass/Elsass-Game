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
 * Les contacts avec une quille COUCHÉE (capsule) ne passent plus par Arcade :
 * ContactsCouchees.js les résout à chaque frame (cf. _processCollisionBouleQuille).
 */

class Quilles {
    /** @param {Phaser.Scene} scene la GameScene propriétaire */
    constructor(scene) {
        this.scene = scene;
        // Vitesses des deux corps AVANT un contact (cf. _memoriserAvantChoc).
        this._avantChoc = new Map();
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
     * Retourne `true` : la séparation/le rebond doivent de toute façon avoir
     * lieu (mur immobile OU quille désormais mobile), SAUF pour une quille
     * couchée (false : ContactsCouchees la résout en capsule).
     */
    _creerColliders() {
        const scene = this.scene;
        scene.physics.add.collider(
            scene.boule, scene.quillesGroup,
            (boule, quille) => { this._corrigerRebondMur(boule, quille); this._chocElastique(boule, quille); },
            (boule, quille) => this._processCollisionBouleQuille(boule, quille),
            scene
        );
        scene.physics.add.collider(
            scene.quillesGroup, scene.quillesGroup,
            (a, b) => { this._corrigerRebondMur(a, b); this._corrigerRebondMur(b, a); this._chocElastique(a, b); },
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
        // Quille couchée : contact résolu en capsule par ContactsCouchees
        // (07/11, John : la boule traversait les bouts). Arcade ne sépare pas.
        if (this._estCouchee(quille)) return false;
        if (quille.getData("debout")) {
            const seuil = (C.boule.vitesseMinRenversePct / 100) * scene.h;
            if (boule.body.speed >= seuil) {
                this._toucherQuille(quille, boule.body.velocity.x, boule.body.velocity.y, boule);
                this._rendreQuilleMobile(quille);
            }
        }
        this._memoriserAvantChoc(boule, quille);
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
        // Une quille couchée est résolue en capsule par ContactsCouchees.
        if (this._estCouchee(a) || this._estCouchee(b)) return false;
        this._essayerRenverserParContact(a, b);
        this._essayerRenverserParContact(b, a);
        this._memoriserAvantChoc(a, b);
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

    /**
     * Mémorise les vitesses (et la rotation, en degrés/s) des deux corps AVANT que Phaser ne résolve le
     * contact (appelé depuis les processCallback, après le basculement éventuel
     * de la quille). Lu par _chocElastique au collideCallback.
     */
    _memoriserAvantChoc(a, b) {
        for (const g of [a, b]) this._avantChoc.set(g.body, { x: g.body.velocity.x, y: g.body.velocity.y, w: g.body.angularVelocity });
    }

    /**
     * Choc élastique entre deux corps MOBILES (boule↔quille, quille↔quille),
     * calculé ici avec config.quille.restitutionChoc.
     *
     * Pourquoi (diagnostic du 07/11, harnais sur le vrai moteur Arcade) : pour
     * deux cercles, Arcade calcule N = 2·(vitesse d'approche)/(mA+mB) puis ajoute
     * N/mA à A et N/mB à B. La formule physique est J = 2·mA·mB·(approche)/(mA+mB) :
     * le moteur oublie le facteur mA·mB. Les masses ne changent pas : seule
     * l'impulsion est recalculée.
     *
     * Les POSITIONS restent celles d'Arcade (séparation des corps). Seules les
     * vitesses (et la rotation) sont remplacées. Un contact qui s'éloigne déjà
     * rétablit les vitesses d'avant le contact. Les corps IMMOBILES (mur, quille
     * encore debout) sont ignorés : leur rebond reste géré par _corrigerRebondMur.
     *
     * Quille COUCHÉE depuis un frame antérieur (cf. _estCouchee) : modèle de TIGE
     * RIGIDE (07/11, demande John : « une quille couchée doit rouler sur le côté
     * et pouvoir tourner comme une toupie »). Le point de contact est sur l'axe :
     * s = projection du centre de l'autre corps sur l'axe, bornée à ±L/2. Le choc
     * donne une vitesse linéaire ET une rotation (I = m·L²/12).
     * Depuis la capsule (07/11) Arcade ne transmet plus ces contacts : ContactsCouchees
     * les résout avec le même modèle (cf. _bras et _impulsion).
     * Cohérence : frappée au centre (s = 0), la quille garde sa masse entière et
     * ne tourne pas ; frappée en bout, perpendiculairement, sa masse effective
     * vaut m/4, la même valeur que masseEffectiveChocFacteur.
     * Une quille renversée CE frame, la boule et les murs gardent le calcul
     * d'avant (masse effective, cf. _masseChoc).
     */
    _chocElastique(a, b) {
        const ca = a.body, cb = b.body;
        if (ca.immovable || cb.immovable) return;
        const va = this._avantChoc.get(ca), vb = this._avantChoc.get(cb);
        if (!va || !vb) return;
        const remettre = () => {
            ca.setVelocity(va.x, va.y); ca.setAngularVelocity(va.w);
            cb.setVelocity(vb.x, vb.y); cb.setAngularVelocity(vb.w);
        };
        const dx = cb.center.x - ca.center.x, dy = cb.center.y - ca.center.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.001) { remettre(); return; }
        // Normale de contact (de A vers B)
        const nx = dx / dist, ny = dy / dist;
        const sortie = this._impulsion(a, b, nx, ny, va, vb, this._bras(a, cb), this._bras(b, ca));
        if (!sortie) { remettre(); return; }
        ca.setVelocity(sortie.A.x, sortie.A.y); ca.setAngularVelocity(sortie.A.w);
        cb.setVelocity(sortie.B.x, sortie.B.y); cb.setAngularVelocity(sortie.B.w);
    }

    /**
     * Bras de levier du point de contact d'une quille COUCHÉE, sur son axe, pour
     * un autre corps : s = projection du centre de l'autre sur l'axe, bornée à ±L/2
     * (tige rigide). null si le corps n'est pas couché.
     */
    _bras(go, autreBody) {
        if (!this._estCouchee(go)) return null;
        const L = this.scene.quilleHauteurTombeePx;
        const th = go.rotation;
        const ax = -Math.sin(th), ay = Math.cos(th);
        const proj = (autreBody.center.x - go.body.center.x) * ax + (autreBody.center.y - go.body.center.y) * ay;
        const s = Math.max(-L / 2, Math.min(L / 2, proj));
        return { x: s * ax, y: s * ay };
    }

    /**
     * Impulsion d'un choc entre deux corps, pour TOUS les chocs (07/11/2026,
     * Orchestrateur : une seule formule, y compris les contacts en capsule de
     * ContactsCouchees). n = normale unitaire de A vers B. vA, vB = {x, y, w} AVANT
     * le choc (w en °/s). rA, rB = bras de levier (point de contact moins centre)
     * pour un corps COUCHÉ, null sinon. Formules inchangées : u = v + ω×r ;
     * k = 1/m + cross(r,n)²/I pour un corps couché, sinon 1/masse effective
     * (_masseChoc) ; j = (1 + restitutionChoc)·approche/(kA + kB) ; ω bornée à
     * vitesseRotationMaxRad_s. Un corps IMMOBILE (mur, quille debout qui ne tombe
     * pas) a k = 0 et ne reçoit rien. Retourne { A, B } (vitesses après le choc,
     * w en °/s), ou null si les corps s'éloignent déjà ou si ce sont deux murs.
     */
    _impulsion(A, B, nx, ny, vA, vB, rA, rB) {
        const C = window.QuillesSaintGallConfig;
        const maxW = C.quille.vitesseRotationMaxRad_s;
        const L = this.scene.quilleHauteurTombeePx;
        const etat = (go, v, r) => {
            const w = Phaser.Math.DegToRad(v.w);   // Arcade parle en degrés/s
            if (go.body.immovable) return { mur: true, w, ux: v.x, uy: v.y, invM: 0, k: 0 };
            if (!r) {
                const invM = 1 / this._masseChoc(go);
                return { mur: false, couche: false, w, ux: v.x, uy: v.y, invM, k: invM };
            }
            const body = go.body;
            const cross = r.x * ny - r.y * nx;          // cross(r, n)
            const I = body.mass * L * L / 12;
            return {
                mur: false, couche: true, w, cross, I, invM: 1 / body.mass,
                k: 1 / body.mass + cross * cross / I,
                ux: v.x - w * r.y, uy: v.y + w * r.x,   // v + ω × r
            };
        };
        const EA = etat(A, vA, rA), EB = etat(B, vB, rB);
        if (EA.mur && EB.mur) return null;
        const approche = (EA.ux - EB.ux) * nx + (EA.uy - EB.uy) * ny;
        if (approche <= 0) return null;
        const j = (1 + C.quille.restitutionChoc) * approche / (EA.k + EB.k);
        const sortie = (v, E, sens) => {
            if (E.mur) return { x: v.x, y: v.y, w: v.w };
            let w = E.w;
            if (E.couche) w += sens * j * E.cross / E.I;
            w = Math.max(-maxW, Math.min(maxW, w));
            return {
                x: v.x + sens * j * E.invM * nx,
                y: v.y + sens * j * E.invM * ny,
                w: Phaser.Math.RadToDeg(w),
            };
        };
        return { A: sortie(vA, EA, -1), B: sortie(vB, EB, +1) };
    }

    /**
     * Quille couchée AVANT ce frame : au sol, mobile, active. Une quille
     * renversée CE frame (chuteFrame = frameMoteur) n'en fait pas partie.
     * frameMoteur (et non frameId) : il avance à chaque frame, y compris après
     * la fin du lancer, pendant que les quilles roulent encore.
     */
    _estCouchee(go) {
        return go.getData("index") !== undefined && !go.getData("debout")
            && go.body.enable && !go.body.immovable
            && go.getData("chuteFrame") !== this.scene.frameMoteur;
    }

    /**
     * Masse EFFECTIVE d'une quille au choc (07/11/2026, Orchestrateur, retour de
     * John « on dirait que les quilles sont 2 fois plus lourdes que la boule ») :
     * une quille frappée près de sa base bascule au lieu de reculer d'un bloc,
     * elle oppose donc bien moins que ses 2,8 kg (tige frappée à son extrémité :
     * m / (1 + m·d²/I) = m/4). Sans ça, en disques 2D, la boule est déviée jusqu'à
     * asin(2,8/5,5) ≈ 31° ; avec, au plus ≈ 7°. Entre deux quilles, le facteur
     * s'annule (même masse). La boule garde sa masse réelle.
     */
    _masseChoc(go) {
        const C = window.QuillesSaintGallConfig;
        return go.getData("index") !== undefined
            ? go.body.mass * C.quille.masseEffectiveChocFacteur
            : go.body.mass;
    }

    /** `cible` tombe-t-elle sous le choc de `source` ? (cf. _processCollisionQuilleQuille) */
    _essayerRenverserParContact(cible, source) {
        const scene = this.scene;
        if (cible === source || !cible.getData("debout") || !cible.body.immovable) return;
        const C = window.QuillesSaintGallConfig;
        const seuil = (C.quille.vitesseMinRenverseAutreQuillePct / 100) * scene.h;
        if (source.body.speed >= seuil) {
            this._toucherQuille(cible, source.body.velocity.x, source.body.velocity.y, source);
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
            q.body.setAngularVelocity(0);

            // Corps physique : absente = désactivé (jamais collisionnable) ;
            // debout = mur immobile (masse "infinie", cf. _rendreQuilleMobile
            // qui le bascule mobile SEULEMENT si elle tombe) ; tombée pendant le
            // jet en cours (redimensionnement en cours de jet) = corps mobile, au
            // repos, avec sa vraie masse. Entre deux jets, une quille abattue en
            // phases D/E est absente (retirée de la piste, cf. GameScene._demarrerJet),
            // donc ce cas ne se présente plus à ce moment-là.
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
        // Couleur portée par la texture, pas par setTint (ignoré en rendu
        // Canvas, cf. GameScene.genererTextures).
        const estAViser = q.getData("index") === scene.regles._indexQuilleAViser();
        q.setTexture(estAViser ? "quilleAViser" : "quilleEnPlace");
        q.setTint(0xffffff);
        q.setDisplaySize(scene.rayonQuille * 2, scene.rayonQuille * 2);
    }

    /**
     * `dirX`/`dirY` : direction du choc qui fait tomber cette quille (la
     * vitesse de la boule à l'impact, ou celle de la quille source pour
     * un ricochet en chaîne) — demande John, 31/08 : "il faut que la
     * quille tombe dans sa direction, pas tous vers le haut". Optionnel,
     * défaut (0,1) = ancien comportement (toujours à la verticale) si
     * appelé sans direction connue. `autre` (optionnel) : le corps qui frappe ;
     * s'il est fourni, la quille se met à tourner (toupie, cf. _donnerToupie).
     */
    _toucherQuille(quille, dirX = 0, dirY = 1, autre = null) {
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
            // Une quille tombe en pivotant sur sa BASE : couchée, son centre
            // est une demi-longueur (moins le rayon) DEVANT sa place debout.
            // Sans ça, la moitié arrière de sa capsule se retrouve dans la
            // boule qui vient de la frapper (07/11/2026). Décalage appliqué par
            // ContactsCouchees.resoudre et pas ici : on est parfois dans un
            // processCallback Arcade, qui reteste le recouvrement juste après.
            const hs = scene.quilleHauteurTombeePx / 2 - scene.rayonQuille;
            quille.setData("decalageChute", { x: dirX / norme * hs, y: dirY / norme * hs });
        }

        // Chute de CE frame : une quille couchée depuis un frame antérieur est
        // résolue par ContactsCouchees (capsule), pas celle-ci.
        quille.setData("chuteFrame", scene.frameMoteur);
        if (autre) this._donnerToupie(quille, autre);

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
     * Toupie au renversement (07/11/2026, demande John : « pivoter comme une
     * toupie »). Le choc frotte la quille en un point hors de son centre : sa
     * composante tangentielle la fait tourner. n = du frappeur vers la quille ;
     * ω0 = facteur × cross(−n, v_rel) / rayon, borné à ±vitesseRotationMaxRad_s.
     */
    _donnerToupie(quille, autre) {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        const cx = quille.body.center.x - autre.body.center.x;
        const cy = quille.body.center.y - autre.body.center.y;
        const d = Math.hypot(cx, cy);
        if (d < 0.0001) return;
        const nx = cx / d, ny = cy / d;
        const vrx = autre.body.velocity.x - quille.body.velocity.x;
        const vry = autre.body.velocity.y - quille.body.velocity.y;
        const cross = (-nx) * vry - (-ny) * vrx;           // cross(−n, v_rel)
        const max = C.quille.vitesseRotationMaxRad_s;
        const w = Math.max(-max, Math.min(max, C.quille.toupieAuChocFacteur * cross / scene.rayonQuille));
        quille.body.setAngularVelocity(Phaser.Math.RadToDeg(w));
    }

    /**
     * Frottement des quilles couchées (corps mobiles, 07/11/2026, demande John :
     * « elles doivent pouvoir rouler sur le côté » et « pivoter comme une
     * toupie »). Anisotrope : glissement LE LONG de l'axe (frictionGlissementPar_s),
     * roulement PERPENDICULAIRE à l'axe (frictionRoulementPar_s, bien plus faible),
     * et ralentissement de la rotation (frictionRotationPar_s). Les quilles encore
     * debout (immovable) ou absentes sont ignorées. Le déplacement et les chocs
     * restent gérés par Arcade (cf. _creerColliders) et _chocElastique, sauf
     * les contacts des quilles couchées (ContactsCouchees).
     */
    _amortirQuillesMobiles(dt) {
        const scene = this.scene;
        const C = window.QuillesSaintGallConfig;
        const amortAxe = Math.max(0, 1 - C.quille.frictionGlissementPar_s * dt);
        const amortPerp = Math.max(0, 1 - C.quille.frictionRoulementPar_s * dt);
        const amortRot = Math.max(0, 1 - C.quille.frictionRotationPar_s * dt);
        scene.quilles.forEach((q) => {
            if (!q.body.enable || q.body.immovable) return;
            const v = q.body.velocity;
            const w = Phaser.Math.DegToRad(q.body.angularVelocity);
            if (v.x === 0 && v.y === 0 && w === 0) return;
            const ax = -Math.sin(q.rotation), ay = Math.cos(q.rotation);
            const vAxe = v.x * ax + v.y * ay;
            const axeX = vAxe * ax, axeY = vAxe * ay;      // v_ax
            const perpX = v.x - axeX, perpY = v.y - axeY;  // v_perp
            let nvx = axeX * amortAxe + perpX * amortPerp;
            let nvy = axeY * amortAxe + perpY * amortPerp;
            if (Math.hypot(nvx, nvy) < 2) { nvx = 0; nvy = 0; }
            let nw = w * amortRot;
            if (Math.abs(nw) < 0.2) nw = 0;
            q.body.setVelocity(nvx, nvy);
            q.body.setAngularVelocity(Phaser.Math.RadToDeg(nw));
        });
    }
}
