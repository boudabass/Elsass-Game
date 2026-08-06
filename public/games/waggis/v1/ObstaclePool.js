/*
 * ObstaclePool.js — pool de sprites d'obstacles avec corps Arcade Physics.
 *
 * CDC 706 §Performance : « Pooling obligatoire pour les obstacles
 * (véhicules, rondins, trains) — ne jamais recréer/détruire en continu,
 * recycler les objets hors écran. » Ce fichier est le pool unique de tous
 * les sprites que LaneGenerator anime : véhicules (route), nénuphars
 * (eau), wagons du train (rails). Il garantit qu'un sprite recyclé est
 * réutilisé (texture changée) au lieu d'être détruit puis recréé, et que
 * son corps Arcade Physics est activé/désactivé avec lui (jamais
 * supprimé/recréé).
 *
 * ÉTAPE 6 — collisions : chaque sprite du pool porte un corps Arcade
 * (créé une seule fois, à la première prise). Le corps suit le sprite
 * automatiquement (Arcade synchronise body ← sprite à chaque frame), il
 * suffit de le dimensionner quand le sprite change de taille
 * (pool.taille / pool.activer). Le décor (arbres/buissons) garde son
 * corps DÉSACTIVÉ : il ne participe à aucune collision. Les véhicules et
 * les nénuphars ont leur corps ACTIVÉ (détection par overlap dans
 * GameScene) ; les wagons du train aussi (le test de mort des rails
 * passe par bande.estMortelAuPoint, le corps reste néanmoins cohérent
 * pour le debug &debug=1).
 *
 * Utilisation (LaneGenerator) :
 *   this.pool = new ObstaclePool(this);
 *   const s = this.pool.prendre("voiture_rouge_droite", DEPTH.vehicule);
 *   this.pool.activer(s, taille);          // corps activé + dimensionné
 *   this.pool.taille(s, taille);           // redimensionnement (recyclage/écran)
 *   this.pool.rendre(s);                   // retour au pool (masqué, corps off)
 */
class ObstaclePool {
    /**
     * @param {Phaser.Scene} scene la scène qui possède les sprites
     */
    constructor(scene) {
        this.scene = scene;
        this.pool = [];   // sprites libres (masqués, corps désactivé)
        // Compteur de sprites réellement créés (jamais détruits ensuite).
        // Exposé pour la QA (probes window.__q / Arcade.game) : preuve du
        // « ne jamais recréer/détruire en continu » du CDC 706 §Performance
        // — après la montée en charge initiale, ce compteur ne bouge plus,
        // seuls les sprites du pool sont réutilisés.
        this.creations = 0;
    }

    /**
     * Prend un sprite du pool (ou en crée un neuf avec son corps Arcade)
     * et lui donne une texture. Le corps est créé UNE SEULE FOIS et reste
     * attaché au sprite pour toute sa vie : les recyclages suivants ne
     * font que changer la texture et réactiver le corps.
     * @param {string} texture clé de texture (assets chargés dans main.js)
     * @param {number} depth profondeur de rendu
     * @returns {Phaser.GameObjects.Sprite} le sprite prêt à positionner
     */
    prendre(texture, depth) {
        let sprite = this.pool.pop();
        if (!sprite) {
            sprite = this.scene.add.sprite(0, 0, texture);
            this.creations++;
            // Corps Arcade créé une fois pour la vie du sprite. Pas de
            // gravité (le monde glisse, rien ne tombe), immobile (les
            // sprites sont déplacés manuellement par LaneGenerator, le
            // corps doit suivre sans être poussé).
            this.scene.physics.add.existing(sprite);
            sprite.body.setAllowGravity(false);
            sprite.body.setImmovable(true);
        } else {
            sprite.setTexture(texture);
            sprite.setVisible(true).setActive(true);
        }
        // Corps DÉSACTIVÉ par défaut : un sprite repris du pool ne
        // collisionne jamais tant qu'il n'est pas un obstacle. Le décor
        // (arbres/buissons) reste inerte pour toute sa vie ; seuls les
        // véhicules, nénuphars et wagons sont réactivés par activer().
        if (sprite.body) sprite.body.enable = false;
        sprite.setDepth(depth);
        return sprite;
    }

    /**
     * Rend un sprite au pool : masqué, inactif, corps désactivé. Le sprite
     * n'est JAMAIS détruit (CDC 706 : ne jamais recréer/détruire en
     * continu).
     */
    rendre(sprite) {
        sprite.setVisible(false).setActive(false);
        if (sprite.body) sprite.body.enable = false;
        this.pool.push(sprite);
    }

    /**
     * Dimensionne un sprite ET son corps (si actif). À utiliser pour
     * redimensionner un obstacle vivant (recyclage de bande, rotation
     * d'écran) : le corps Arcade ne suit pas le displaySize tout seul, il
     * faut le redimensionner explicitement, sinon la hitbox garde la
     * taille de la texture source (8x8) et la collision devient fausse.
     * @param {Phaser.GameObjects.Sprite} sprite
     * @param {number} taille côté carré (px)
     */
    taille(sprite, taille) {
        sprite.setDisplaySize(taille, taille);
        if (sprite.body && sprite.body.enable) {
            sprite.body.setSize(taille, taille);
        }
    }

    /**
     * Active le corps d'un sprite et le dimensionne (obstacle qui doit
     * participer aux collisions : véhicule, nénuphar, wagon). À appeler
     * après prendre() quand le sprite devient un obstacle vivant.
     * @param {Phaser.GameObjects.Sprite} sprite
     * @param {number} taille côté carré (px)
     */
    activer(sprite, taille) {
        sprite.setDisplaySize(taille, taille);
        if (sprite.body) {
            sprite.body.enable = true;
            sprite.body.setSize(taille, taille);
            sprite.body.setAllowGravity(false);
            sprite.body.setImmovable(true);
        }
    }
}
