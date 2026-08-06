/*
 * decor.js — le terrain de Waggis, bande par bande.
 *
 * De bas en haut : berge de départ (herbe), route (pavés), rivière (eau),
 * berge d'arrivée (herbe). Les bandes sont dessinées une fois puis répétées
 * en tuiles (tileSprite) : zéro octet à télécharger en plus des sprites.
 *
 * ÉTAPE 1 : la route et la rivière sont des bandes visibles mais vides.
 * Les véhicules (route) et les éléments flottants (rivière) arriveront aux
 * étapes suivantes.
 */
class WaggisDecor {
    /** Appelé une seule fois pendant le chargement. */
    static genererTextures(scene) {
        const C = window.WaggisConfig;
        const g = scene.make.graphics({ add: false });

        // --- Herbe des berges (64 x 64) ---
        g.fillStyle(C.couleurs.herbe, 1);
        g.fillRect(0, 0, 64, 64);
        g.fillStyle(C.couleurs.herbeSombre, 1);
        for (let i = 0; i < 64; i += 16) g.fillRect(i, 12, 8, 6); // touffes
        g.generateTexture("herbe", 64, 64);

        g.destroy();
    }

    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Dessine les 4 bandes du terrain + les arbres/buissons des berges.
     * Recalculé à chaque rotation de l'écran.
     */
    creerFond() {
        const C = window.WaggisConfig;
        const scene = this.scene;

        // Bandes : herbe basse, route, eau, herbe haute (ordre d'affichage).
        this.herbeBas = scene.add.tileSprite(0, 0, 10, 10, "herbe").setOrigin(0, 0);
        this.route = scene.add.tileSprite(0, 0, 10, 10, "route").setOrigin(0, 0);
        this.eau = scene.add.tileSprite(0, 0, 10, 10, "eau").setOrigin(0, 0);
        this.herbeHaut = scene.add.tileSprite(0, 0, 10, 10, "herbe").setOrigin(0, 0);

        // Arbres et buissons des berges (décor).
        this.arbres = [];
        this.buissons = [];
        for (let i = 0; i < 7; i++) {
            this.arbres.push(scene.add.image(0, 0, "arbre").setDepth(5));
        }
        for (let i = 0; i < 4; i++) {
            this.buissons.push(scene.add.image(0, 0, "buisson").setDepth(5));
        }

        Arcade.UI.layout(scene, (w, h) => {
            const bergeDep = h * (C.bergeDepPct / 100);
            const route = h * (C.routePct / 100);
            const riviere = h * (C.rivierePct / 100);
            const bergeArr = h * (C.bergeArrPct / 100);

            // Positions : on part du bas de l'écran.
            this.herbeBas.setSize(w, bergeDep).setPosition(0, h - bergeDep);
            this.route.setSize(w, route).setPosition(0, h - bergeDep - route);
            this.eau.setSize(w, riviere).setPosition(0, h - bergeDep - route - riviere);
            this.herbeHaut.setSize(w, bergeArr).setPosition(0, 0);

            // Végétation : arbres éparpillés sur les deux berges, buissons
            // entre eux. Tailles en % du plus petit côté.
            const tArbre = Arcade.UI.u(scene, 12);
            const tBuisson = Arcade.UI.u(scene, 8);

            // Berge d'arrivée (en haut)
            const xs = [0.1, 0.3, 0.5, 0.7, 0.9];
            for (let i = 0; i < 5; i++) {
                this.arbres[i].setDisplaySize(tArbre, tArbre)
                    .setPosition(w * xs[i], bergeArr * 0.5);
            }
            // Berge de départ (en bas)
            this.arbres[5].setDisplaySize(tArbre, tArbre)
                .setPosition(w * 0.15, h - bergeDep * 0.5);
            this.arbres[6].setDisplaySize(tArbre, tArbre)
                .setPosition(w * 0.85, h - bergeDep * 0.5);

            // Buissons : un sur chaque berge, entre les arbres
            this.buissons[0].setDisplaySize(tBuisson, tBuisson)
                .setPosition(w * 0.2, bergeArr * 0.65);
            this.buissons[1].setDisplaySize(tBuisson, tBuisson)
                .setPosition(w * 0.8, bergeArr * 0.65);
            this.buissons[2].setDisplaySize(tBuisson, tBuisson)
                .setPosition(w * 0.35, h - bergeDep * 0.6);
            this.buissons[3].setDisplaySize(tBuisson, tBuisson)
                .setPosition(w * 0.65, h - bergeDep * 0.6);
        });

        return this;
    }

    /**
     * Position Y du centre de la berge d'arrivée : c'est là que le
     * personnage gagne quand il l'atteint.
     */
    arriveeY() {
        const C = window.WaggisConfig;
        return this.scene.scale.height * (C.bergeArrPct / 100) * 0.5;
    }
}
