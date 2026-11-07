'use strict';
/*
 * tests/contacts.test.js — contacts des quilles couchées en capsule
 * (ContactsCouchees.js) et impulsion commune (Quilles._impulsion), 07/11/2026.
 *
 * Charge config.js, Quilles.js et ContactsCouchees.js dans un contexte vm avec un
 * Phaser minimal (conversion d'angles seulement) : aucun moteur lancé.
 *
 * Lancement : node tests/contacts.test.js   (depuis public/games/quillessaintgall/v1)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const v1 = path.join(__dirname, '..');
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext('var Phaser = { Math: { DegToRad: (d) => d * Math.PI / 180, RadToDeg: (r) => r * 180 / Math.PI } };', ctx);
for (const f of ['config.js', 'Quilles.js', 'ContactsCouchees.js']) {
    vm.runInContext(fs.readFileSync(path.join(v1, f), 'utf8'), ctx, { filename: f });
}
const Quilles = vm.runInContext('Quilles', ctx);
const ContactsCouchees = vm.runInContext('ContactsCouchees', ctx);
const C = ctx.window.QuillesSaintGallConfig;

const RQ = 9;                  // rayon d'une quille (scene.rayonQuille)
const L = 63;                  // longueur affichée d'une quille couchée
const HS = L / 2 - RQ;         // demi-longueur de la partie droite de la capsule
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// Corps de test : sprite (x, y, rotation) + corps Arcade réduit à ce qui est lu.
// `index` absent = pas une quille (boule, bande), comme dans le jeu.
function corps(x, y, { masse = 2.8, immovable = false, index, debout = false, rotation = 0 } = {}) {
    const data = { debout };
    if (index !== undefined) data.index = index;
    const go = {
        x, y, rotation,
        getData: (k) => data[k],
        setData: (k, v) => { data[k] = v; },
        body: {
            mass: masse, immovable, enable: true,
            velocity: { x: 0, y: 0 }, angularVelocity: 0, bounce: { x: 0.85, y: 0.85 },
            center: { x, y },
            setVelocity(vx, vy) { this.velocity = { x: vx, y: vy }; },
            setAngularVelocity(w) { this.angularVelocity = w; },
            updateFromGameObject() { this.center = { x: go.x, y: go.y }; },
        },
    };
    return go;
}

// Scène minimale : piste de x = −100 à x = 300 (bords intérieurs des bandes), lancer à y = 600.
function scene(extra = {}) {
    const s = {
        rayonQuille: RQ, quilleHauteurTombeePx: L, h: 800, frameMoteur: 1,
        pisteOffsetX: -100, pisteLargeur: 400, ligneLancerY: 600,
        quilles: [],
        boule: corps(500, 500, { masse: 5.5 }),
        bandes: { gauche: corps(-150, 300, { immovable: true }), droite: corps(350, 300, { immovable: true }) },
        ...extra,
    };
    s.boule.displayWidth = 48;   // rayon effectif 24 (cf. Visee.positionnerBoule)
    s.quillesSys = new Quilles(s);
    return s;
}

const tests = [];
const test = (nom, fn) => tests.push({ nom, fn });

test('point le plus proche : milieu, puis bouts bornés', () => {
    const P = ContactsCouchees.pointLePlusProcheSegment;
    let r = P(5, 10, 0, 0, 0, 1, HS);
    assert.ok(near(r.t, 10) && near(r.qx, 0) && near(r.qy, 10), 'au milieu de l\'axe vertical');
    r = P(5, 100, 0, 0, 0, 1, HS);
    assert.ok(near(r.t, HS) && near(r.qy, HS), 'au-delà du bout bas : borné à +hs');
    r = P(-5, -100, 0, 0, 0, 1, HS);
    assert.ok(near(r.t, -HS) && near(r.qy, -HS), 'au-delà du bout haut : borné à −hs');
    r = P(30, 7, 0, 0, 1, 0, HS);
    assert.ok(near(r.t, HS) && near(r.qx, HS) && near(r.qy, 0), 'axe horizontal, borné');
});

test('segments : croisés, parallèles décalés, bout contre milieu', () => {
    const S = ContactsCouchees.segmentsLesPlusProches;
    let r = S({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, { x: 0, y: 0 }, { x: 0, y: 1 }, 10);
    assert.ok(near(Math.hypot(r.p2.x - r.p1.x, r.p2.y - r.p1.y), 0, 1e-9), 'croisés : distance 0');
    r = S({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, { x: 4, y: 3 }, { x: 1, y: 0 }, 10);
    assert.ok(near(Math.hypot(r.p2.x - r.p1.x, r.p2.y - r.p1.y), 3, 1e-9), 'parallèles décalés de 3 : distance 3');
    // Bout de (0,0)–(10,0) contre le milieu de (10,−5)–(10,5) : contact au bout et au milieu.
    r = S({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, { x: 10, y: 0 }, { x: 0, y: 1 }, 5);
    assert.ok(near(r.t1, 10) && near(r.t2, 0) && near(Math.hypot(r.p2.x - r.p1.x, r.p2.y - r.p1.y), 0, 1e-9),
        'bout contre milieu : t1 = 10, t2 = 0');
});

test('segments : distance exacte, comparée à une recherche par échantillonnage', () => {
    const S = ContactsCouchees.segmentsLesPlusProches;
    let graine = 12345;
    const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
    const N = 300;
    for (let k = 0; k < 300; k++) {
        const angle1 = alea() * Math.PI * 2, angle2 = alea() * Math.PI * 2;
        const c1 = { x: alea() * 200 - 100, y: alea() * 200 - 100 };
        const c2 = { x: alea() * 200 - 100, y: alea() * 200 - 100 };
        const a1 = { x: Math.cos(angle1), y: Math.sin(angle1) }, a2 = { x: Math.cos(angle2), y: Math.sin(angle2) };
        const h1 = alea() * 30, h2 = alea() * 30;
        const r = S(c1, a1, h1, c2, a2, h2);
        const exact = Math.hypot(r.p2.x - r.p1.x, r.p2.y - r.p1.y);
        // Les points renvoyés doivent appartenir aux segments.
        assert.ok(Math.abs(r.t1) <= h1 + 1e-9 && Math.abs(r.t2) <= h2 + 1e-9, 'paramètres bornés');
        let brute = Infinity;
        for (let i = 0; i <= N; i++) {
            const p = { x: c1.x + (2 * i / N - 1) * h1 * a1.x, y: c1.y + (2 * i / N - 1) * h1 * a1.y };
            for (let j = 0; j <= N; j++) {
                const q = { x: c2.x + (2 * j / N - 1) * h2 * a2.x, y: c2.y + (2 * j / N - 1) * h2 * a2.y };
                brute = Math.min(brute, Math.hypot(q.x - p.x, q.y - p.y));
            }
        }
        assert.ok(exact <= brute + 1e-6, `distance exacte ≤ échantillon (${exact} / ${brute})`);
        assert.ok(brute - exact < 0.2, `distance exacte proche de l'échantillon (${exact} / ${brute})`);
    }
});

test('_impulsion, deux couchées : quantité de mouvement conservée', () => {
    const s = scene();
    const S = s.quillesSys;
    const A = corps(0, 0, { index: 1, debout: false, rotation: 0 });
    const B = corps(15, 0, { index: 2, debout: false, rotation: 0 });
    const vA = { x: 10, y: 0, w: 0 }, vB = { x: -4, y: 2, w: 30 };
    const out = S._impulsion(A, B, 1, 0, vA, vB, { x: 0, y: 5 }, { x: 0, y: -3 });
    assert.ok(out, 'il y a approche : un choc est calculé');
    const dpx = A.body.mass * (out.A.x - vA.x) + B.body.mass * (out.B.x - vB.x);
    const dpy = A.body.mass * (out.A.y - vA.y) + B.body.mass * (out.B.y - vB.y);
    assert.ok(Math.abs(dpx) < 1e-6 && Math.abs(dpy) < 1e-6, `Δp = (${dpx}, ${dpy})`);
    assert.ok(out.A.x < vA.x && out.B.x > vB.x, 'A ralentit, B est poussée');
});

test('boule frappant le BOUT d\'une couchée (à 0,9·hs du centre) : vitesse ET rotation', () => {
    // Quille horizontale : θ = π/2 donne a = (−1, 0). Centre (0, 300), boule au-dessus du bout droit.
    const q = corps(0, 300, { index: 0, rotation: Math.PI / 2 });
    const boule = corps(0.9 * HS, 280, { masse: 5.5 });
    boule.displayWidth = 48;
    boule.body.velocity = { x: 0, y: 600 };
    const s = scene({ quilles: [q], boule });
    s.boule = boule;
    assert.ok(s.quillesSys._estCouchee(q), 'la quille est bien couchée');
    new ContactsCouchees(s).resoudre();
    assert.ok(q.body.velocity.y > 0, `la quille part vers le bas (vy = ${q.body.velocity.y})`);
    assert.ok(q.body.angularVelocity !== 0, `la quille tourne (ω = ${q.body.angularVelocity} °/s)`);
    assert.strictEqual(boule.getData('dejaTouche'), true, 'contact marqué');
    assert.ok(boule.body.velocity.y < 600, 'la boule ralentit');
});

test('mur : vitesse normale inversée × restitutionChoc', () => {
    const s = scene();
    const S = s.quillesSys;
    const A = corps(0, 0, { masse: 5.5 });                  // corps mobile non couché (ex. boule)
    const M = corps(0, 20, { immovable: true, index: 0, debout: true });   // quille debout
    const e = C.quille.restitutionChoc;
    const out = S._impulsion(A, M, 0, 1, { x: 2, y: 10, w: 0 }, { x: 0, y: 0, w: 0 }, null, null);
    assert.ok(out, 'choc calculé');
    assert.ok(near(out.A.x, 2, 1e-9), 'composante tangentielle inchangée');
    assert.ok(near(out.A.y, -e * 10, 1e-9), `vN' = −e·vN (${out.A.y} ≠ ${-e * 10})`);
    assert.ok(out.B.x === 0 && out.B.y === 0 && out.B.w === 0, 'le mur ne reçoit rien');
});

test('bande : le bout qui dépasse est ramené dans la piste et rebondit', () => {
    // Quille horizontale centrée en x = −70 : son bout gauche (−92,5 − 9) dépasse le bord −100.
    const q = corps(-70, 300, { index: 0, rotation: Math.PI / 2 });
    q.body.velocity = { x: -50, y: 0 };
    const s = scene({ quilles: [q] });
    new ContactsCouchees(s).resoudre();
    assert.ok(near(q.x, -68.5, 1e-9), `ramenée de 1,5 px vers la piste (x = ${q.x})`);
    assert.ok(q.body.velocity.x > 0, `rebond vers la piste (vx = ${q.body.velocity.x})`);
});

let echecs = 0;
for (const t of tests) {
    try {
        t.fn();
        console.log(`ok   ${t.nom}`);
    } catch (err) {
        echecs++;
        console.log(`ECHEC ${t.nom}\n      ${err.message}`);
    }
}
console.log(`\n${tests.length - echecs}/${tests.length} tests OK`);
process.exitCode = echecs ? 1 : 0;
