// Outline-Modell des CJ-6 (Meter; x = Fahrtrichtung, y = oben, z = links/Fahrerseite).
// Hauptmaße nach dem CJ-6 ab 1972 (Radstand 104 Zoll = 2642 mm), Kleinteile geschätzt.
// Ein Schaubild zum Finden von Bauteilen, keine maßgenaue Konstruktion.
// Jedes Modellteil hat eine feste ID, über die später Bauteile der Datenbank verknüpft werden.
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Path,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
} from 'three';

export const MODELL_GRUPPEN = ['karosserie', 'antrieb', 'fahrwerk', 'kraftstoff', 'elektrik'] as const;
export type ModellGruppe = (typeof MODELL_GRUPPEN)[number];

export const MODELL_TEIL_IDS = [
  'wanne',
  'motorhaube',
  'kotfluegel',
  'kuehlergrill',
  'frontscheibe',
  'armaturenbrett',
  'stossstangen',
  'sitze',
  'reserverad',
  'motor',
  'kuehler',
  'getriebe',
  'verteilergetriebe',
  'kardanwellen',
  'auspuff',
  'rahmen',
  'vorderachse',
  'hinterachse',
  'blattfedern',
  'stossdaempfer',
  'bremsen_vorne',
  'bremsen_hinten',
  'raeder',
  'lenkung',
  'benzintank',
  'gastank',
  'gasleitung',
  'verdampfer',
  'batterie',
  'beleuchtung',
] as const;
export type ModellTeilId = (typeof MODELL_TEIL_IDS)[number];

export interface ModellTeil {
  id: ModellTeilId;
  gruppe: ModellGruppe;
  geometrien: BufferGeometry[];
}

type Punkt = [number, number, number];
type Achse = 'x' | 'y' | 'z';

// ---------- Hauptmaße ----------
const ACHSE_X = 1.321; // halber Radstand (2642 mm)
const RAD_R = 0.36; // Reifen ca. 28 Zoll
const SPUR_Z = 0.65; // halbe Spurweite
const RAHMEN_Z = 0.42;
const BODEN_Y = 0.62;
const WANNE_Z = 0.7; // halbe Wannenbreite
const WANNE_HINTEN_X = -2.1;
const SPRITZWAND_X = 0.5;
const HAUBE_OBEN_Y = 1.05;
const GRILL_X = 1.79;
const SEITEN = [1, -1] as const;

const OBEN = new Vector3(0, 1, 0);

// ---------- Grundformen ----------
function quader(b: number, h: number, t: number, [x, y, z]: Punkt, dreh?: { x?: number; y?: number; z?: number }) {
  const g = new BoxGeometry(b, h, t);
  if (dreh?.x) g.rotateX(dreh.x);
  if (dreh?.y) g.rotateY(dreh.y);
  if (dreh?.z) g.rotateZ(dreh.z);
  return g.translate(x, y, z);
}

/** Quader zwischen zwei x-, y- und z-Grenzen. */
function block(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  return quader(x1 - x0, y1 - y0, z1 - z0, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]);
}

/** Dreht eine um die y-Achse gebaute Geometrie so, dass +y in Richtung `richtung` zeigt, und verschiebt sie. */
function ausrichten(g: BufferGeometry, richtung: Punkt, mitte: Punkt) {
  g.applyQuaternion(new Quaternion().setFromUnitVectors(OBEN, new Vector3(...richtung).normalize()));
  return g.translate(...mitte);
}

function achsRichtung(achse: Achse, vorzeichen: 1 | -1 = 1): Punkt {
  return achse === 'x' ? [vorzeichen, 0, 0] : achse === 'y' ? [0, vorzeichen, 0] : [0, 0, vorzeichen];
}

function zylinder(r: number, h: number, mitte: Punkt, achse: Achse = 'y', segmente = 32, rOben = r) {
  return ausrichten(new CylinderGeometry(rOben, r, h, segmente), achsRichtung(achse), mitte);
}

/** Drehteil aus einem Profil [Radius, Höhe] um die y-Achse, danach ausgerichtet. */
function drehteil(profil: [number, number][], richtung: Punkt, mitte: Punkt, segmente = 48) {
  const g = new LatheGeometry(profil.map(([r, h]) => new Vector2(r, h)), segmente);
  return ausrichten(g, richtung, mitte);
}

function rohr(a: Punkt, b: Punkt, r: number, segmente = 16) {
  const start = new Vector3(...a);
  const ende = new Vector3(...b);
  const g = new CylinderGeometry(r, r, start.distanceTo(ende), segmente);
  const mitte = start.clone().add(ende).multiplyScalar(0.5);
  return ausrichten(g, [ende.x - start.x, ende.y - start.y, ende.z - start.z], [mitte.x, mitte.y, mitte.z]);
}

/** Rohrleitung über mehrere Punkte. */
function leitung(punkte: Punkt[], r: number) {
  return punkte.slice(1).map((p, i) => rohr(punkte[i]!, p, r, 12));
}

const EXTRUSION = { bevelEnabled: false, curveSegments: 20 } as const;

/** Seitenprofil (x, y) in z-Richtung ausgezogen, von z0 bis z0 + tiefe. */
function seitenteil(form: Shape, tiefe: number, z0: number) {
  return new ExtrudeGeometry(form, { ...EXTRUSION, depth: tiefe }).translate(0, 0, z0);
}

/** Querprofil (z, y) in x-Richtung ausgezogen, von xVorn - laenge bis xVorn. */
function querteil(form: Shape, laenge: number, xVorn: number) {
  const g = new ExtrudeGeometry(form, { ...EXTRUSION, depth: laenge });
  g.rotateY(-Math.PI / 2); // Profil-x → Welt-z, Auszug → Welt -x
  return g.translate(xVorn, 0, 0);
}

function rechteck(x0: number, y0: number, x1: number, y1: number, ziel: Path = new Path()) {
  ziel.moveTo(x0, y0);
  ziel.lineTo(x1, y0);
  ziel.lineTo(x1, y1);
  ziel.lineTo(x0, y1);
  ziel.lineTo(x0, y0);
  return ziel;
}

function abgerundet(x0: number, y0: number, x1: number, y1: number, r: number, ziel: Path = new Path()) {
  ziel.moveTo(x0 + r, y0);
  ziel.lineTo(x1 - r, y0);
  ziel.quadraticCurveTo(x1, y0, x1, y0 + r);
  ziel.lineTo(x1, y1 - r);
  ziel.quadraticCurveTo(x1, y1, x1 - r, y1);
  ziel.lineTo(x0 + r, y1);
  ziel.quadraticCurveTo(x0, y1, x0, y1 - r);
  ziel.lineTo(x0, y0 + r);
  ziel.quadraticCurveTo(x0, y0, x0 + r, y0);
  return ziel;
}

function kreis(x: number, y: number, r: number) {
  const p = new Path();
  p.absarc(x, y, r, 0, Math.PI * 2, false);
  return p;
}

/** Senkrechter Schlitz mit runden Enden. */
function schlitz(x: number, y0: number, y1: number, breite: number) {
  const r = breite / 2;
  const p = new Path();
  p.moveTo(x + r, y1 - r);
  p.absarc(x, y1 - r, r, 0, Math.PI, false);
  p.lineTo(x - r, y0 + r);
  p.absarc(x, y0 + r, r, Math.PI, Math.PI * 2, false);
  p.lineTo(x + r, y1 - r);
  return p;
}

/** Radlauf-Bogen: Kreis um die Radmitte, unten vom Wannenboden abgeschnitten. */
const RADLAUF_R = 0.44;
const RADLAUF_WINKEL = Math.asin((BODEN_Y - RAD_R) / RADLAUF_R);

// ---------- Baugruppen ----------

/** Rad mit Reifen, Stahlfelge, Radkappe und fünf Radmuttern; `aussen` zeigt nach außen. */
function rad(mitte: Punkt, aussen: Punkt): BufferGeometry[] {
  const reifen: [number, number][] = [
    [0.195, -0.085],
    [0.25, -0.1],
    [0.31, -0.105],
    [0.345, -0.094],
    [RAD_R, -0.068],
    [RAD_R, 0.068],
    [0.345, 0.094],
    [0.31, 0.105],
    [0.25, 0.1],
    [0.195, 0.085],
  ];
  const felge: [number, number][] = [
    [0.198, -0.075],
    [0.19, -0.068],
    [0.172, -0.05],
    [0.172, 0.05],
    [0.19, 0.068],
    [0.198, 0.075],
  ];
  const schuessel: [number, number][] = [
    [0.172, 0.0],
    [0.14, 0.014],
    [0.085, 0.022],
    [0.055, 0.024],
    [0.05, 0.042],
    [0.032, 0.054],
    [0, 0.056],
  ];
  const teile = [drehteil(reifen, aussen, mitte), drehteil(felge, aussen, mitte), drehteil(schuessel, aussen, mitte, 36)];
  // Radmuttern im lokalen System (Achse y), dann wie das Rad ausgerichtet.
  for (let i = 0; i < 5; i++) {
    const w = (i / 5) * Math.PI * 2;
    const mutter = new CylinderGeometry(0.009, 0.009, 0.02, 6).translate(Math.cos(w) * 0.068, 0.034, Math.sin(w) * 0.068);
    teile.push(ausrichten(mutter, aussen, mitte));
  }
  return teile;
}

/** Bremstrommel mit Ankerblech, innen am Rad. */
function bremse(x: number, seite: 1 | -1): BufferGeometry[] {
  return [
    zylinder(0.14, 0.07, [x, RAD_R, seite * 0.505], 'z', 40),
    zylinder(0.152, 0.006, [x, RAD_R, seite * 0.465], 'z', 40),
    zylinder(0.012, 0.03, [x, RAD_R + 0.1, seite * 0.455], 'z', 12), // Radbremszylinder
  ];
}

/** Differentialgehäuse; `ritzel` zeigt zur Fahrzeugmitte (Kardanwelle). */
function differential(mitte: Punkt, ritzel: 1 | -1, r: number): BufferGeometry[] {
  const [x, y, z] = mitte;
  const birne: [number, number][] = [
    [r * 0.95, -0.07],
    [r, -0.03],
    [r * 0.97, 0.02],
    [r * 0.75, 0.07],
    [0.06, 0.1],
    [0.045, 0.16],
  ];
  return [
    drehteil(birne, [ritzel, 0, 0], mitte, 40),
    zylinder(r * 0.98, 0.012, [x - ritzel * 0.075, y, z], 'x', 40), // Deckel
  ];
}

/** Blattfederpaket unter der Achse: Hauptlage mit Augen, darunter kürzere Lagen. */
function blattfeder(xMitte: number, laenge: number, z: number, lagen: number): BufferGeometry[] {
  const teile: BufferGeometry[] = [];
  const yMitte = RAD_R - 0.045;
  const stich = 0.11; // Bogenhöhe der Hauptlage
  const dicke = 0.01;
  for (let i = 0; i < lagen; i++) {
    const halb = (laenge / 2) * (1 - i * 0.16);
    const versatz = i * (dicke + 0.002);
    const form = new Shape();
    const schritte = 14;
    const oben: Vector2[] = [];
    for (let s = 0; s <= schritte; s++) {
      const dx = -halb + (2 * halb * s) / schritte;
      oben.push(new Vector2(xMitte + dx, yMitte - versatz + stich * (dx / (laenge / 2)) ** 2));
    }
    form.moveTo(oben[0]!.x, oben[0]!.y);
    for (const p of oben.slice(1)) form.lineTo(p.x, p.y);
    for (const p of [...oben].reverse()) form.lineTo(p.x, p.y - dicke);
    form.lineTo(oben[0]!.x, oben[0]!.y);
    teile.push(seitenteil(form, 0.05, z - 0.025));
  }
  const yAuge = yMitte + stich + 0.012;
  for (const s of [-1, 1]) teile.push(zylinder(0.018, 0.055, [xMitte + (s * laenge) / 2, yAuge, z], 'z', 16));
  // Federbock vorn, Federlasche hinten bis zum Rahmen
  teile.push(block(xMitte + laenge / 2 - 0.03, xMitte + laenge / 2 + 0.03, yAuge, 0.49, z - 0.03, z + 0.03));
  teile.push(rohr([xMitte - laenge / 2, yAuge, z], [xMitte - laenge / 2 - 0.04, 0.49, z], 0.012, 8));
  // Federbriden um die Achse
  for (const dz of [-0.04, 0.04]) teile.push(block(xMitte - 0.008, xMitte + 0.008, yMitte - 0.03, RAD_R + 0.045, z + dz - 0.006, z + dz + 0.006));
  return teile;
}

function stossdaempfer(oben: Punkt, unten: Punkt): BufferGeometry[] {
  const mitte: Punkt = [(oben[0] + unten[0]) / 2, (oben[1] + unten[1]) / 2, (oben[2] + unten[2]) / 2];
  return [rohr(unten, mitte, 0.026), rohr(mitte, oben, 0.011)];
}

// ---------- Profile ----------

/** Seitenwand der Wanne mit Türausschnitt, Radlauf und Anstieg zur Spritzwand. */
function wannenSeite(): Shape {
  const s = new Shape();
  s.moveTo(WANNE_HINTEN_X, BODEN_Y);
  s.lineTo(WANNE_HINTEN_X, 0.91);
  s.quadraticCurveTo(WANNE_HINTEN_X, 0.95, WANNE_HINTEN_X + 0.04, 0.95);
  s.lineTo(-0.7, 0.95);
  s.quadraticCurveTo(-0.62, 0.95, -0.6, 0.86);
  s.quadraticCurveTo(-0.56, 0.77, -0.42, 0.77);
  s.lineTo(0.06, 0.77);
  s.quadraticCurveTo(0.26, 0.77, 0.32, 0.95);
  s.lineTo(0.4, 1.03);
  s.lineTo(SPRITZWAND_X, 1.03);
  s.lineTo(SPRITZWAND_X, BODEN_Y);
  s.absarc(-ACHSE_X, RAD_R, RADLAUF_R, RADLAUF_WINKEL, Math.PI - RADLAUF_WINKEL, false);
  s.lineTo(WANNE_HINTEN_X, BODEN_Y);
  return s;
}

function radkasten(xMitte: number): Shape {
  const s = new Shape();
  const dx = RADLAUF_R * Math.cos(RADLAUF_WINKEL);
  s.moveTo(xMitte + dx, BODEN_Y);
  s.absarc(xMitte, RAD_R, RADLAUF_R, RADLAUF_WINKEL, Math.PI - RADLAUF_WINKEL, false);
  s.lineTo(xMitte + dx, BODEN_Y);
  return s;
}

/** Innenkotflügel vorn: Wand zwischen Motorraum und Rad, mit Radausschnitt. */
function innenKotfluegel(): Shape {
  const s = new Shape();
  const dx = RADLAUF_R * Math.cos(RADLAUF_WINKEL);
  s.moveTo(SPRITZWAND_X + 0.05, 0.56);
  s.lineTo(ACHSE_X - dx, 0.56);
  s.absarc(ACHSE_X, RAD_R, RADLAUF_R, Math.PI - Math.asin((0.56 - RAD_R) / RADLAUF_R), Math.asin((0.56 - RAD_R) / RADLAUF_R), true);
  s.lineTo(GRILL_X - 0.04, 0.56);
  s.lineTo(GRILL_X - 0.04, 0.86);
  s.lineTo(SPRITZWAND_X + 0.05, 0.86);
  s.lineTo(SPRITZWAND_X + 0.05, 0.56);
  return s;
}

/** Flacher CJ-Kotflügel im Seitenprofil: senkrechte Hinterkante, flache Oberseite, runde Vorderkante. */
function kotfluegelProfil(): Shape {
  const t = 0.022;
  const s = new Shape();
  s.moveTo(SPRITZWAND_X, 0.7);
  s.lineTo(SPRITZWAND_X, 0.875);
  s.lineTo(1.62, 0.875);
  s.quadraticCurveTo(1.82, 0.875, 1.84, 0.7);
  s.lineTo(1.84 - t, 0.7);
  s.quadraticCurveTo(1.8, 0.875 - t, 1.62, 0.875 - t);
  s.lineTo(SPRITZWAND_X + t, 0.875 - t);
  s.lineTo(SPRITZWAND_X + t, 0.7);
  s.lineTo(SPRITZWAND_X, 0.7);
  return s;
}

/** Querschnitt der Haube mit gerundeten Kanten (z, y). */
function haubenProfil(): Shape {
  const b = 0.49;
  const r = 0.06;
  const s = new Shape();
  s.moveTo(-b, 0.87);
  s.lineTo(b, 0.87);
  s.lineTo(b, HAUBE_OBEN_Y - r);
  s.quadraticCurveTo(b, HAUBE_OBEN_Y, b - r, HAUBE_OBEN_Y);
  s.lineTo(-b + r, HAUBE_OBEN_Y);
  s.quadraticCurveTo(-b, HAUBE_OBEN_Y, -b, HAUBE_OBEN_Y - r);
  s.lineTo(-b, 0.87);
  return s;
}

/** Grill (z, y): sieben Schlitze, Scheinwerfer- und Standlichtöffnungen. */
function grillProfil(): Shape {
  const s = new Shape();
  s.moveTo(-0.5, 0.52);
  s.lineTo(0.5, 0.52);
  s.lineTo(0.49, 0.98);
  s.quadraticCurveTo(0.48, 1.03, 0.43, 1.03);
  s.lineTo(-0.43, 1.03);
  s.quadraticCurveTo(-0.48, 1.03, -0.49, 0.98);
  s.lineTo(-0.5, 0.52);
  for (let i = -3; i <= 3; i++) s.holes.push(schlitz(i * 0.075, 0.62, 0.96, 0.036));
  for (const z of [-0.36, 0.36]) s.holes.push(kreis(z, 0.86, 0.086), kreis(z, 0.66, 0.03));
  return s;
}

function armaturenProfil(): Shape {
  const s = abgerundet(-0.66, 0.84, 0.66, 1.0, 0.03, new Shape()) as Shape;
  s.holes.push(kreis(0.33, 0.925, 0.06)); // Tacho vor dem Fahrer
  s.holes.push(kreis(0.16, 0.925, 0.035), kreis(0.08, 0.925, 0.035)); // Anzeigen
  s.holes.push(abgerundet(-0.5, 0.88, -0.24, 0.97, 0.015)); // Handschuhfach
  return s;
}

/** C-Profil eines Rahmenlängsträgers (z, y), offen zur Fahrzeugmitte. */
function rahmenProfil(seite: 1 | -1): Shape {
  const h0 = 0.49;
  const h1 = 0.61;
  const aussen = seite * (RAHMEN_Z + 0.025);
  const innen = seite * (RAHMEN_Z - 0.025);
  const steg = seite * (RAHMEN_Z + 0.019);
  const s = new Shape();
  s.moveTo(innen, h0);
  s.lineTo(aussen, h0);
  s.lineTo(aussen, h1);
  s.lineTo(innen, h1);
  s.lineTo(innen, h1 - 0.006);
  s.lineTo(steg, h1 - 0.006);
  s.lineTo(steg, h0 + 0.006);
  s.lineTo(innen, h0 + 0.006);
  s.lineTo(innen, h0);
  return s;
}

/** Schalensitz im Seitenprofil (x, y), Blick nach vorn = +x. */
function sitzProfil(): Shape {
  const s = new Shape();
  s.moveTo(-0.05, 0);
  s.lineTo(0.4, 0);
  s.quadraticCurveTo(0.44, 0, 0.44, 0.05);
  s.lineTo(0.44, 0.08);
  s.quadraticCurveTo(0.44, 0.12, 0.38, 0.12);
  s.lineTo(0.06, 0.11);
  s.lineTo(-0.02, 0.56);
  s.quadraticCurveTo(-0.04, 0.6, -0.09, 0.58);
  s.lineTo(-0.11, 0.56);
  s.lineTo(-0.05, 0);
  return s;
}

// ---------- Modell ----------

export function baueModell(): ModellTeil[] {
  // Scheibenrahmen: im eigenen System gebaut (Unterkante bei y = 0), dann nach hinten geneigt.
  const scheibe = (g: BufferGeometry) => g.rotateZ(0.2).translate(0.47, 1.04, 0);
  const scheibenRahmen = new Shape();
  abgerundet(-0.65, 0, 0.65, 0.6, 0.04, scheibenRahmen);
  scheibenRahmen.holes.push(abgerundet(-0.61, 0.045, 0.61, 0.555, 0.03));

  const sitz = (x: number, z: number, breite: number) => seitenteil(sitzProfil(), breite, z - breite / 2).translate(x, 0.7, 0);

  const radPositionen: [number, 1 | -1][] = [];
  for (const x of [ACHSE_X, -ACHSE_X]) for (const s of SEITEN) radPositionen.push([x, s]);

  return [
    // ----- Karosserie -----
    {
      id: 'wanne',
      gruppe: 'karosserie',
      geometrien: [
        ...SEITEN.map((s) => seitenteil(wannenSeite(), 0.03, s > 0 ? WANNE_Z - 0.03 : -WANNE_Z)),
        ...SEITEN.map((s) => seitenteil(radkasten(-ACHSE_X), 0.22, s > 0 ? WANNE_Z - 0.25 : -WANNE_Z + 0.03)),
        querteil(abgerundet(-WANNE_Z, BODEN_Y, WANNE_Z, 0.95, 0.04, new Shape()) as Shape, 0.03, WANNE_HINTEN_X + 0.03), // Heckwand
        block(WANNE_HINTEN_X + 0.03, SPRITZWAND_X, BODEN_Y - 0.01, BODEN_Y + 0.01, -WANNE_Z + 0.03, WANNE_Z - 0.03), // Boden
        querteil(rechteck(-WANNE_Z + 0.03, BODEN_Y, WANNE_Z - 0.03, 1.02, new Shape()) as Shape, 0.02, SPRITZWAND_X), // Spritzwand
        block(0.4, SPRITZWAND_X + 0.02, 1.02, 1.04, -WANNE_Z, WANNE_Z), // Windlauf
      ],
    },
    {
      id: 'motorhaube',
      gruppe: 'karosserie',
      geometrien: [
        querteil(haubenProfil(), GRILL_X - SPRITZWAND_X - 0.03, GRILL_X - 0.01),
        ...SEITEN.map((s) => block(1.56, 1.62, 0.93, 0.98, s * 0.49, s * 0.505)), // Haubenhalter
      ],
    },
    {
      id: 'kotfluegel',
      gruppe: 'karosserie',
      geometrien: SEITEN.flatMap((s) => [
        seitenteil(kotfluegelProfil(), 0.3, s > 0 ? 0.47 : -0.77),
        seitenteil(innenKotfluegel(), 0.015, s > 0 ? 0.47 : -0.485),
      ]),
    },
    { id: 'kuehlergrill', gruppe: 'karosserie', geometrien: [querteil(grillProfil(), 0.03, GRILL_X)] },
    {
      id: 'frontscheibe',
      gruppe: 'karosserie',
      geometrien: [
        scheibe(querteil(scheibenRahmen, 0.035, 0.0175)),
        ...SEITEN.map((s) => zylinder(0.016, 0.07, [0.47, 1.045, s * 0.56], 'z', 16)), // Scharniere
        ...SEITEN.map((s) => scheibe(quader(0.008, 0.012, 0.34, [-0.025, 0.075, s * 0.24 - 0.02], { x: s * 0.12 }))), // Wischer in Ruhestellung
        ...SEITEN.map((s) => scheibe(zylinder(0.012, 0.03, [0, 0.4, s * 0.68], 'z', 12))), // Klemmen
      ],
    },
    { id: 'armaturenbrett', gruppe: 'karosserie', geometrien: [querteil(armaturenProfil(), 0.02, 0.47)] },
    {
      id: 'stossstangen',
      gruppe: 'karosserie',
      geometrien: [
        querteil(
          (() => {
            // Vorn: U-Profil quer über die Front (im Seitenschnitt offen nach hinten), hier als Querbalken.
            return abgerundet(-0.75, 0.47, 0.75, 0.6, 0.01, new Shape()) as Shape;
          })(),
          0.09,
          1.94,
        ),
        ...SEITEN.map((s) => block(WANNE_HINTEN_X - 0.06, WANNE_HINTEN_X, 0.47, 0.58, s * RAHMEN_Z - 0.05, s * RAHMEN_Z + 0.05)), // Heck-Prallbügel
      ],
    },
    {
      id: 'sitze',
      gruppe: 'karosserie',
      geometrien: [sitz(-0.42, 0.33, 0.42), sitz(-0.42, -0.33, 0.42), sitz(-1.42, 0, 0.86)],
    },
    {
      id: 'reserverad',
      gruppe: 'karosserie',
      geometrien: [...rad([WANNE_HINTEN_X - 0.16, 0.86, 0], [-1, 0, 0]), block(WANNE_HINTEN_X - 0.06, WANNE_HINTEN_X, 0.82, 0.9, -0.05, 0.05)],
    },

    // ----- Motor und Antrieb -----
    {
      id: 'motor',
      gruppe: 'antrieb',
      geometrien: [
        block(0.66, 1.46, 0.52, 0.84, -0.15, 0.15), // Block (Reihensechser)
        block(0.68, 1.44, 0.84, 0.93, -0.135, 0.135), // Zylinderkopf
        querteil(abgerundet(-0.11, 0.93, 0.11, 0.99, 0.025, new Shape()) as Shape, 0.72, 1.42), // Ventildeckel
        block(0.72, 1.4, 0.4, 0.52, -0.13, 0.13), // Ölwanne
        block(0.75, 1.35, 0.78, 0.86, 0.15, 0.24), // Ansaugkrümmer
        rohr([0.75, 0.72, 0.2], [1.35, 0.72, 0.2], 0.03), // Abgaskrümmer
        ...[0.8, 1.0, 1.2].map((x) => rohr([x, 0.72, 0.15], [x, 0.72, 0.2], 0.022, 10)),
        block(1.0, 1.1, 0.86, 0.9, 0.17, 0.27), // Vergaser
        zylinder(0.15, 0.06, [1.05, 0.965, 0.2], 'y', 40), // Luftfilter
        ...[0.73, 0.86, 0.99, 1.12, 1.25, 1.38].map((x) => rohr([x, 0.87, -0.135], [x, 0.9, -0.17], 0.008, 8)), // Zündkerzen
        rohr([1.1, 0.72, -0.18], [1.1, 0.84, -0.22], 0.035), // Verteiler
        zylinder(0.055, 0.04, [1.1, 0.86, -0.225], 'y', 24), // Verteilerkappe
        zylinder(0.07, 0.13, [1.46, 0.7, -0.22], 'x', 28), // Lichtmaschine
        zylinder(0.07, 0.02, [1.5, 0.6, 0], 'x', 32), // Kurbelwellen-Riemenscheibe
        zylinder(0.06, 0.02, [1.52, 0.78, 0], 'x', 32), // Wasserpumpen-Riemenscheibe
        zylinder(0.035, 0.05, [1.555, 0.78, 0], 'x', 16), // Lüfternabe
        ...[0, 1, 2, 3].map((k) =>
          new BoxGeometry(0.012, 0.15, 0.055)
            .rotateY(0.35)
            .translate(0, 0.1, 0)
            .rotateX((k * Math.PI) / 2 + 0.3)
            .translate(1.57, 0.78, 0),
        ), // Lüfterflügel
        zylinder(0.045, 0.11, [1.0, 0.58, -0.2], 'z', 20), // Ölfilter
        zylinder(0.05, 0.2, [0.6, 0.55, -0.2], 'x', 20), // Anlasser
      ],
    },
    {
      id: 'kuehler',
      gruppe: 'antrieb',
      geometrien: [
        block(1.66, 1.7, 0.56, 0.98, -0.32, 0.32), // Netz
        block(1.65, 1.71, 0.98, 1.02, -0.32, 0.32), // oberer Wasserkasten
        block(1.65, 1.71, 0.52, 0.56, -0.32, 0.32), // unterer Wasserkasten
        zylinder(0.025, 0.02, [1.68, 1.03, 0.2], 'y', 16), // Kühlerdeckel
        rohr([1.65, 0.99, 0.1], [1.46, 0.92, 0], 0.025), // oberer Schlauch
        rohr([1.65, 0.55, -0.2], [1.5, 0.68, -0.05], 0.025), // unterer Schlauch
      ],
    },
    {
      id: 'getriebe',
      gruppe: 'antrieb',
      geometrien: [
        drehteil(
          [
            [0.21, 0],
            [0.2, 0.02],
            [0.14, 0.17],
            [0.13, 0.2],
          ],
          [-1, 0, 0],
          [0.66, 0.66, 0],
          40,
        ), // Kupplungsglocke
        block(0.12, 0.46, 0.5, 0.72, -0.11, 0.11), // Gehäuse
        block(0.18, 0.4, 0.72, 0.74, -0.09, 0.09), // Deckel
        rohr([0.3, 0.74, 0.02], [0.2, 1.08, 0.06], 0.008, 8), // Schalthebel
        zylinder(0.02, 0.04, [0.2, 1.1, 0.06], 'y', 16), // Schaltknauf
      ],
    },
    {
      id: 'verteilergetriebe',
      gruppe: 'antrieb',
      geometrien: [
        block(-0.18, 0.12, 0.44, 0.7, -0.2, 0.1),
        zylinder(0.05, 0.06, [0.15, 0.47, -0.22], 'x', 24), // Abtrieb vorn
        rohr([0.0, 0.7, -0.05], [-0.04, 1.0, -0.05], 0.007, 8), // Schalthebel
        rohr([0.02, 0.7, -0.13], [-0.02, 0.98, -0.13], 0.007, 8),
      ],
    },
    {
      id: 'kardanwellen',
      gruppe: 'antrieb',
      geometrien: [
        rohr([0.18, 0.47, -0.22], [ACHSE_X - 0.2, RAD_R, -0.25], 0.03),
        rohr([-0.18, 0.52, -0.02], [-ACHSE_X + 0.2, RAD_R, 0], 0.035),
        ...(
          [
            [0.18, 0.47, -0.22],
            [ACHSE_X - 0.2, RAD_R, -0.25],
            [-0.18, 0.52, -0.02],
            [-ACHSE_X + 0.2, RAD_R, 0],
          ] as Punkt[]
        ).map((p) => quader(0.05, 0.05, 0.05, p)), // Kreuzgelenke
      ],
    },
    {
      id: 'auspuff',
      gruppe: 'antrieb',
      geometrien: [
        ...leitung(
          [
            [0.9, 0.7, 0.22],
            [0.62, 0.42, 0.3],
            [-0.55, 0.42, 0.3],
          ],
          0.025,
        ),
        zylinder(0.1, 0.5, [-0.8, 0.42, 0.3], 'x', 32), // Schalldämpfer
        ...leitung(
          [
            [-1.05, 0.42, 0.3],
            [-1.15, 0.27, 0.3],
            [-1.5, 0.27, 0.3],
            [-1.65, 0.42, 0.3],
            [WANNE_HINTEN_X - 0.04, 0.42, 0.3],
          ],
          0.022,
        ),
      ],
    },

    // ----- Fahrwerk -----
    {
      id: 'rahmen',
      gruppe: 'fahrwerk',
      geometrien: [
        querteil(rahmenProfil(1), 3.95, 1.88),
        querteil(rahmenProfil(-1), 3.95, 1.88),
        block(1.66, 1.74, 0.5, 0.6, -RAHMEN_Z, RAHMEN_Z), // vorderer Querträger
        block(0.0, 0.1, 0.44, 0.5, -RAHMEN_Z, RAHMEN_Z), // Getriebeträger
        block(-1.0, -0.92, 0.5, 0.6, -RAHMEN_Z, RAHMEN_Z),
        block(-2.06, -1.98, 0.5, 0.6, -RAHMEN_Z, RAHMEN_Z), // hinterer Querträger
      ],
    },
    {
      id: 'vorderachse',
      gruppe: 'fahrwerk',
      geometrien: [
        zylinder(0.042, 1.1, [ACHSE_X, RAD_R, 0], 'z', 24),
        ...differential([ACHSE_X, RAD_R, -0.25], -1, 0.13),
        ...SEITEN.map((s) =>
          drehteil(
            [
              [0, -0.09],
              [0.06, -0.08],
              [0.08, -0.04],
              [0.085, 0],
              [0.08, 0.04],
              [0.06, 0.08],
              [0, 0.09],
            ],
            [0, 1, 0],
            [ACHSE_X, RAD_R, s * 0.555],
            24,
          ),
        ), // Achsschenkel
      ],
    },
    {
      id: 'hinterachse',
      gruppe: 'fahrwerk',
      geometrien: [zylinder(0.045, 1.16, [-ACHSE_X, RAD_R, 0], 'z', 24), ...differential([-ACHSE_X, RAD_R, -0.05], 1, 0.14)],
    },
    {
      id: 'blattfedern',
      gruppe: 'fahrwerk',
      geometrien: SEITEN.flatMap((s) => [...blattfeder(ACHSE_X, 0.92, s * RAHMEN_Z, 5), ...blattfeder(-ACHSE_X, 1.17, s * RAHMEN_Z, 5)]),
    },
    {
      id: 'stossdaempfer',
      gruppe: 'fahrwerk',
      geometrien: SEITEN.flatMap((s) => [
        ...stossdaempfer([ACHSE_X + 0.14, 0.6, s * (RAHMEN_Z - 0.07)], [ACHSE_X + 0.06, 0.3, s * (RAHMEN_Z - 0.02)]),
        ...stossdaempfer([-ACHSE_X - s * 0.2, 0.6, s * (RAHMEN_Z - 0.07)], [-ACHSE_X - s * 0.06, 0.3, s * (RAHMEN_Z - 0.02)]),
      ]),
    },
    { id: 'bremsen_vorne', gruppe: 'fahrwerk', geometrien: SEITEN.flatMap((s) => bremse(ACHSE_X, s)) },
    { id: 'bremsen_hinten', gruppe: 'fahrwerk', geometrien: SEITEN.flatMap((s) => bremse(-ACHSE_X, s)) },
    { id: 'raeder', gruppe: 'fahrwerk', geometrien: radPositionen.flatMap(([x, s]) => rad([x, RAD_R, s * SPUR_Z], [0, 0, s])) },
    {
      id: 'lenkung',
      gruppe: 'fahrwerk',
      geometrien: (() => {
        const lenkradMitte: Punkt = [0.17, 1.12, 0.33];
        const saeule: Punkt = [-1.36, 0.48, -0.05];
        const lenkrad = (g: BufferGeometry) => ausrichten(g, saeule, lenkradMitte);
        return [
          block(1.56, 1.68, 0.52, 0.64, 0.33, 0.43), // Lenkgetriebe am Rahmen
          rohr([1.56, 0.62, 0.38], lenkradMitte, 0.022), // Lenksäule
          lenkrad(
            new LatheGeometry(
              [
                [0.172, -0.012],
                [0.19, -0.012],
                [0.19, 0.012],
                [0.172, 0.012],
                [0.172, -0.012],
              ].map(([r, h]) => new Vector2(r, h)),
              48,
            ),
          ), // Lenkradkranz
          ...[0, 1, 2].map((k) =>
            lenkrad(new BoxGeometry(0.16, 0.008, 0.02).translate(0.09, 0, 0).rotateY((k * Math.PI * 2) / 3 + Math.PI / 2)),
          ), // Speichen
          lenkrad(new CylinderGeometry(0.035, 0.035, 0.03, 20)), // Nabe
          rohr([1.62, 0.52, 0.45], [1.62, 0.38, 0.47], 0.015, 8), // Lenkstockhebel
          rohr([1.62, 0.38, 0.48], [ACHSE_X + 0.05, 0.36, 0.6], 0.014, 8), // Lenkstange
          rohr([ACHSE_X - 0.13, 0.33, -0.56], [ACHSE_X - 0.13, 0.33, 0.56], 0.014, 8), // Spurstange
          ...SEITEN.map((s) => rohr([ACHSE_X, 0.33, s * 0.56], [ACHSE_X - 0.13, 0.33, s * 0.56], 0.015, 8)), // Spurhebel
        ];
      })(),
    },

    // ----- Kraftstoff und Gasanlage -----
    {
      id: 'benzintank',
      gruppe: 'kraftstoff',
      geometrien: [
        querteil(abgerundet(0.12, 0.63, 0.54, 0.69, 0.02, new Shape()) as Shape, 0.55, -0.15), // flacher Tank unter dem Fahrersitz
        rohr([-0.3, 0.69, 0.52], [-0.3, 0.88, 0.66], 0.022), // Einfüllstutzen
        zylinder(0.035, 0.02, [-0.3, 0.88, WANNE_Z + 0.005], 'z', 20), // Tankdeckel
      ],
    },
    {
      id: 'gastank',
      gruppe: 'kraftstoff',
      geometrien: [
        drehteil(
          [
            [0, -0.45],
            [0.08, -0.44],
            [0.13, -0.41],
            [0.16, -0.36],
            [0.16, 0.36],
            [0.13, 0.41],
            [0.08, 0.44],
            [0, 0.45],
          ],
          [0, 0, 1],
          [-1.72, 0.81, 0],
          40,
        ),
        ...[-0.25, 0.25].map((z) => zylinder(0.166, 0.03, [-1.72, 0.81, z], 'z', 40)), // Spannbänder
        block(-1.76, -1.68, 0.96, 1.0, 0.16, 0.24), // Multiventil
      ],
    },
    {
      id: 'gasleitung',
      gruppe: 'kraftstoff',
      geometrien: leitung(
        [
          [-1.72, 0.98, 0.24],
          [-1.62, 0.7, 0.52],
          [-1.62, 0.47, 0.52],
          [1.2, 0.47, 0.52],
          [1.4, 0.72, 0.36],
        ],
        0.007,
      ),
    },
    {
      id: 'verdampfer',
      gruppe: 'kraftstoff',
      geometrien: [
        zylinder(0.075, 0.07, [1.4, 0.74, 0.36], 'z', 32), // Verdampfer
        rohr([1.4, 0.8, 0.33], [1.12, 0.9, 0.25], 0.016, 12), // Gasschlauch zum Mischer
        zylinder(0.06, 0.025, [1.05, 0.917, 0.2], 'y', 32), // Gasmischer unter dem Luftfilter
      ],
    },

    // ----- Elektrik -----
    {
      id: 'batterie',
      gruppe: 'elektrik',
      geometrien: [
        block(1.1, 1.36, 0.66, 0.84, -0.46, -0.3),
        zylinder(0.012, 0.02, [1.15, 0.85, -0.38], 'y', 12),
        zylinder(0.012, 0.02, [1.31, 0.85, -0.38], 'y', 12),
        ...leitung(
          [
            [1.15, 0.86, -0.38],
            [0.9, 0.62, -0.3],
            [0.62, 0.58, -0.22],
          ],
          0.008,
        ),
      ],
    },
    {
      id: 'beleuchtung',
      gruppe: 'elektrik',
      geometrien: [
        ...SEITEN.map((s) => zylinder(0.09, 0.08, [GRILL_X - 0.06, 0.86, s * 0.36], 'x', 36, 0.07)), // Scheinwerfertopf
        ...SEITEN.map((s) => zylinder(0.03, 0.03, [GRILL_X - 0.01, 0.66, s * 0.36], 'x', 20)), // Standlicht
        ...SEITEN.map((s) => block(WANNE_HINTEN_X - 0.025, WANNE_HINTEN_X, 0.76, 0.88, s * 0.62 - 0.04, s * 0.62 + 0.04)), // Rückleuchten
      ],
    },
  ];
}
