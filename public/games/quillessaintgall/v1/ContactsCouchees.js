/*
 * ContactsCouchees.js — contacts des quilles COUCHÉES, en capsule (07/11/2026,
 * retour de John : « la boule traverse les bouts des quilles couchées, c'est
 * sûr que ce n'est pas normal »).
 *
 * Une quille couchée est une capsule : le segment [c − hs·a, c + hs·a] gonflé
 * du rayon rQ (scene.rayonQuille), avec c = centre du sprite, a = (−sin θ, cos θ),
 * θ = q.rotation, hs = L/2 − rQ, L = scene.quilleHauteurTombeePx. Longueur totale
 * L, largeur 2·rQ : exactement le rectangle affiché, bouts arrondis.
 *
 * Arcade ne sépare plus ces contacts (processCallback à false, cf.
 * Quilles._processCollisionBouleQuille et _processCollisionQuilleQuille) : ils
 * sont résolus ICI, à chaque frame, après le mouvement Arcade (GameScene.update).
 * La boule et les quilles debout restent des cercles gérés par Arcade.
 *
 * Toutes les impulsions passent par Quilles._impulsion (une seule formule). Les
 * géométries pures (pointLePlusProcheSegment, segmentsLesPlusProches) sont
 * statiques et testées dans tests/contacts.test.js.
 */
class ContactsCouchees {
    /** @param {Phaser.Scene} scene la GameScene propriétaire */
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Point du segment [c − hs·a, c + hs·a] le plus proche de (px, py). `t` est
     * le paramètre sur l'axe, borné à ±hs : le point vaut c + t·a, et t·a est le
     * bras de levier du contact.
     */
    static pointLePlusProcheSegment(px, py, cx, cy, ax, ay, hs) {
        const t = Math.max(-hs, Math.min(hs, (px - cx) * ax + (py - cy) * ay));
        return { t, qx: cx + t * ax, qy: cy + t * ay };
    }

    /**
     * Points les plus proches de deux segments (Ericson, Real-Time Collision
     * Detection §5.1.9, bornes incluses, cas parallèle compris). Segment i :
     * c_i + t·a_i pour |t| ≤ h_i. Renvoie t1, t2 (paramètres sur l'axe, donc
     * bras de levier t·a) et les points p1, p2.
     */
    static segmentsLesPlusProches(c1, a1, h1, c2, a2, h2) {
        const borne = (v) => Math.max(0, Math.min(1, v));
        // Forme d'Ericson : P + s·d avec s ∈ [0, 1], P = c − h·a, d = 2h·a.
        const P1x = c1.x - h1 * a1.x, P1y = c1.y - h1 * a1.y;
        const P2x = c2.x - h2 * a2.x, P2y = c2.y - h2 * a2.y;
        const d1x = 2 * h1 * a1.x, d1y = 2 * h1 * a1.y;
        const d2x = 2 * h2 * a2.x, d2y = 2 * h2 * a2.y;
        const rx = P1x - P2x, ry = P1y - P2y;
        const a = d1x * d1x + d1y * d1y;
        const e = d2x * d2x + d2y * d2y;
        const f = d2x * rx + d2y * ry;
        const c = d1x * rx + d1y * ry;
        const b = d1x * d2x + d1y * d2y;
        const denom = a * e - b * b;
        const eps = 1e-12;
        let s = 0, t = 0;
        if (a <= eps && e <= eps) {
            s = 0; t = 0;                                  // deux points
        } else if (a <= eps) {
            t = borne(f / e);
        } else if (e <= eps) {
            s = borne(-c / a);
        } else {
            // Segments parallèles (denom ≈ 0) : s = 0 suffit, la distance ne dépend pas de s.
            s = denom > eps * a * e ? borne((b * f - c * e) / denom) : 0;
            t = (b * s + f) / e;
            if (t < 0) { t = 0; s = borne(-c / a); }
            else if (t > 1) { t = 1; s = borne((b - c) / a); }
        }
        const p1 = { x: P1x + s * d1x, y: P1y + s * d1y };
        const p2 = { x: P2x + t * d2x, y: P2y + t * d2y };
        return { t1: (2 * s - 1) * h1, t2: (2 * t - 1) * h2, p1, p2 };
    }

    /**
     * Résout les contacts qui touchent une quille couchée, à chaque frame (appelé
     * depuis GameScene.update, après le mouvement Arcade). Ordre : la boule, puis
     * les quilles debout, puis les couchées entre elles (chaque paire une seule
     * fois, i < j), puis les bouts contre les bandes latérales.
     */
    resoudre() {
        const scene = this.scene;
        const S = scene.quillesSys;
        // Pivot sur la base des quilles tombées depuis le dernier passage
        // (cf. Quilles._toucherQuille) : leur centre avance d'une demi-longueur.
        scene.quilles.forEach((q) => {
            const d = q.getData("decalageChute");
            if (!d) return;
            q.setData("decalageChute", null);
            if (q.body.enable) this._deplacer(q, d.x, d.y);
        });
        const couchees = scene.quilles.filter((q) => S._estCouchee(q));
        if (couchees.length === 0) return;
        const debout = scene.quilles.filter((q) => q.body.enable && q.getData("debout"));
        couchees.forEach((q) => this._bouleContreCouchee(q));
        couchees.forEach((q) => debout.forEach((d) => this._coucheeContreDebout(q, d)));
        for (let i = 0; i < couchees.length; i++) {
            for (let j = i + 1; j < couchees.length; j++) this._coucheeContreCouchee(couchees[i], couchees[j]);
        }
        couchees.forEach((q) => this._boutsContreBandes(q));
    }

    /** Boule ↔ quille couchée : la boule est repoussée hors de la capsule, puis choc. */
    _bouleContreCouchee(q) {
        const scene = this.scene;
        const boule = scene.boule;
        const rB = boule.displayWidth / 2;             // rayon effectif (cf. Visee.positionnerBoule)
        const seg = this._segment(q);
        const cb = boule.body.center;
        const p = ContactsCouchees.pointLePlusProcheSegment(cb.x, cb.y, seg.c.x, seg.c.y, seg.a.x, seg.a.y, seg.hs);
        const dx = p.qx - cb.x, dy = p.qy - cb.y;         // de la boule vers la quille
        const d = Math.hypot(dx, dy);
        if (d >= rB + scene.rayonQuille) return;
        const n = d > 1e-6 ? { x: dx / d, y: dy / d } : { x: -seg.a.y, y: seg.a.x };
        this._separer(boule, q, n, rB + scene.rayonQuille - d);
        boule.setData("dejaTouche", true);
        const r = { x: p.t * seg.a.x, y: p.t * seg.a.y };
        this._choquer(scene.quillesSys._impulsion(boule, q, n.x, n.y, this._vitesse(boule), this._vitesse(q), null, r), boule, q);
    }

    /**
     * Quille couchée ↔ quille DEBOUT. Si la vitesse du point de contact de la
     * couchée, projetée sur n, atteint le seuil de renversement, la debout tombe
     * (elle devient mobile et reçoit la masse effective). Sinon elle reste un mur
     * (k = 0) : la couchée absorbe toute la séparation.
     */
    _coucheeContreDebout(q, d) {
        if (!d.getData("debout")) return;              // tombée entre-temps dans ce même passage
        const scene = this.scene;
        const S = scene.quillesSys;
        const C = window.QuillesSaintGallConfig;
        const rQ = scene.rayonQuille;
        const seg = this._segment(q);
        const cd = d.body.center;
        const p = ContactsCouchees.pointLePlusProcheSegment(cd.x, cd.y, seg.c.x, seg.c.y, seg.a.x, seg.a.y, seg.hs);
        const dx = cd.x - p.qx, dy = cd.y - p.qy;     // du point de contact vers la quille debout
        const dist = Math.hypot(dx, dy);
        if (dist >= 2 * rQ) return;
        const n = dist > 1e-6 ? { x: dx / dist, y: dy / dist } : { x: -seg.a.y, y: seg.a.x };
        const r = { x: p.t * seg.a.x, y: p.t * seg.a.y };
        const vc = this._vitessePoint(q, r);
        const seuil = (C.quille.vitesseMinRenverseAutreQuillePct / 100) * scene.h;
        if (vc.x * n.x + vc.y * n.y >= seuil) {
            S._toucherQuille(d, n.x, n.y, q);
            S._rendreQuilleMobile(d);
        }
        this._separer(q, d, n, 2 * rQ - dist);
        this._choquer(S._impulsion(q, d, n.x, n.y, this._vitesse(q), this._vitesse(d), r, null), q, d);
    }

    /** Quille couchée ↔ quille couchée : séparation par masses, puis choc sur les deux bras de levier. */
    _coucheeContreCouchee(A, B) {
        const scene = this.scene;
        const rQ = scene.rayonQuille;
        const sa = this._segment(A), sb = this._segment(B);
        const res = ContactsCouchees.segmentsLesPlusProches(sa.c, sa.a, sa.hs, sb.c, sb.a, sb.hs);
        const dx = res.p2.x - res.p1.x, dy = res.p2.y - res.p1.y;
        const d = Math.hypot(dx, dy);
        if (d >= 2 * rQ) return;
        const n = d > 1e-6 ? { x: dx / d, y: dy / d } : { x: -sa.a.y, y: sa.a.x };
        this._separer(A, B, n, 2 * rQ - d);
        const rA = { x: res.t1 * sa.a.x, y: res.t1 * sa.a.y };
        const rB = { x: res.t2 * sb.a.x, y: res.t2 * sb.a.y };
        this._choquer(scene.quillesSys._impulsion(A, B, n.x, n.y, this._vitesse(A), this._vitesse(B), rA, rB), A, B);
    }

    /**
     * Bouts de la capsule contre les bandes latérales (bords intérieurs de la
     * piste). Les bandes couvrent y ∈ [0, ligneLancerY] (BandesLaterales.positionner) :
     * un bout hors de cette plage n'est pas contraint. Le bout qui dépasse est
     * ramené dans la piste, puis rebondit contre un mur de normale horizontale,
     * avec r = ±hs·a : la quille tourne en rebondissant.
     */
    _boutsContreBandes(q) {
        const scene = this.scene;
        const rQ = scene.rayonQuille;
        const hauteur = scene.ligneLancerY;
        const xGauche = scene.pisteOffsetX;                       // bord intérieur de la bande gauche
        const xDroite = scene.pisteOffsetX + scene.pisteLargeur;  // bord intérieur de la bande droite
        for (const s of [-1, 1]) {
            const seg = this._segment(q);                         // relu : le bout précédent a pu déplacer la quille
            const r = { x: s * seg.hs * seg.a.x, y: s * seg.hs * seg.a.y };
            const ex = seg.c.x + r.x, ey = seg.c.y + r.y;
            if (ey < 0 || ey > hauteur) continue;
            if (ex - rQ < xGauche) this._contreBande(q, scene.bandes.gauche, xGauche - (ex - rQ), -1, r);
            else if (ex + rQ > xDroite) this._contreBande(q, scene.bandes.droite, xDroite - (ex + rQ), +1, r);
        }
    }

    /** Ramène la quille de `dx` (en x) puis la fait rebondir sur la bande (normale horizontale nx). */
    _contreBande(q, bande, dx, nx, r) {
        this._deplacer(q, dx, 0);
        const sortie = this.scene.quillesSys._impulsion(q, bande, nx, 0, this._vitesse(q), this._vitesse(bande), r, null);
        this._choquer(sortie, q, bande);
    }

    /**
     * Axe, centre et demi-longueur de la partie droite de la capsule d'une
     * quille couchée. Lus sur le CORPS (body.center, body.rotation en degrés),
     * pas sur le sprite : resoudre() tourne dans GameScene.update, après le pas
     * Arcade mais AVANT que le sprite ne le recopie (body.postUpdate) ; le
     * sprite a donc une frame de retard à ce moment-là.
     */
    _segment(q) {
        const scene = this.scene;
        const th = Phaser.Math.DegToRad(q.body.rotation);
        return {
            c: { x: q.body.center.x, y: q.body.center.y },
            a: { x: -Math.sin(th), y: Math.cos(th) },
            hs: scene.quilleHauteurTombeePx / 2 - scene.rayonQuille,
        };
    }

    /**
     * Sépare deux corps le long de n (de A vers B) pour résorber `delta`, en
     * proportion des inverses des masses réelles. Un corps immobile ne bouge pas :
     * l'autre prend toute la séparation.
     */
    _separer(A, B, n, delta) {
        const iA = A.body.immovable ? 0 : 1 / A.body.mass;
        const iB = B.body.immovable ? 0 : 1 / B.body.mass;
        const somme = iA + iB;
        if (somme === 0) return;
        const k = delta / somme;
        this._deplacer(A, -n.x * k * iA, -n.y * k * iA);
        this._deplacer(B, n.x * k * iB, n.y * k * iB);
    }

    /**
     * Déplace le CORPS seulement : body.postUpdate recopie ensuite sur le
     * sprite tout le déplacement de la frame (mouvement Arcade + cette
     * correction). Déplacer le sprite puis appeler updateFromGameObject()
     * perdrait le mouvement de la frame et appliquerait la correction deux fois.
     */
    _deplacer(go, dx, dy) {
        go.body.position.x += dx;
        go.body.position.y += dy;
        go.body.updateCenter();
    }

    /** Applique les vitesses calculées par Quilles._impulsion (un mur ne reçoit rien). */
    _choquer(sortie, A, B) {
        if (!sortie) return;
        this._appliquer(A, sortie.A);
        this._appliquer(B, sortie.B);
    }

    _appliquer(go, v) {
        if (go.body.immovable) return;
        go.body.setVelocity(v.x, v.y);
        go.body.setAngularVelocity(v.w);
    }

    /** État cinématique d'un corps pour Quilles._impulsion : vitesse, rotation (°/s). */
    _vitesse(go) {
        return { x: go.body.velocity.x, y: go.body.velocity.y, w: go.body.angularVelocity };
    }

    /** Vitesse (u = v + ω × r) du point de contact r d'un corps : ω en °/s dans Arcade. */
    _vitessePoint(go, r) {
        const w = Phaser.Math.DegToRad(go.body.angularVelocity);
        return { x: go.body.velocity.x - w * r.y, y: go.body.velocity.y + w * r.x };
    }
}
