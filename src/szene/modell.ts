// Outline-Modell des CJ-6 aus Grundformen (Meter; x = Fahrtrichtung, y = oben, z = links).
// Grob nach Radstand 2565 mm und üblichen CJ-6-Maßen; kein maßgenaues Modell.
// Jedes Modellteil hat eine feste ID, über die später Bauteile der Datenbank verknüpft werden.
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Path,
  Quaternion,
  Shape,
  Vector3,
} from 'three';

export const MODELL_GRUPPEN = ['karosserie', 'antrieb', 'fahrwerk', 'kraftstoff'] as const;
export type ModellGruppe = (typeof MODELL_GRUPPEN)[number];

export const MODELL_TEIL_IDS = [
  'wanne',
  'motorhaube',
  'kotfluegel',
  'kuehlergrill',
  'frontscheibe',
  'stossstangen',
  'sitze',
  'reserverad',
  'motor',
  'kuehler',
  'getriebe',
  'verteilergetriebe',
  'kardanwellen',
  'rahmen',
  'vorderachse',
  'hinterachse',
  'blattfedern',
  'bremsen_vorne',
  'bremsen_hinten',
  'raeder',
  'lenkung',
  'benzintank',
  'gastank',
  'auspuff',
] as const;
export type ModellTeilId = (typeof MODELL_TEIL_IDS)[number];

export interface ModellTeil {
  id: ModellTeilId;
  gruppe: ModellGruppe;
  geometrien: BufferGeometry[];
}

const OBEN = new Vector3(0, 1, 0);

type Achse = 'x' | 'y' | 'z';

function quader(b: number, h: number, t: number, x: number, y: number, z: number, drehZ = 0): BufferGeometry {
  const g = new BoxGeometry(b, h, t);
  if (drehZ) g.rotateZ(drehZ);
  return g.translate(x, y, z);
}

function zylinder(r: number, h: number, segmente: number, x: number, y: number, z: number, achse: Achse = 'y', rOben = r) {
  const g = new CylinderGeometry(rOben, r, h, segmente);
  if (achse === 'z') g.rotateX(Math.PI / 2);
  if (achse === 'x') g.rotateZ(Math.PI / 2);
  return g.translate(x, y, z);
}

/** Rohr zwischen zwei Punkten (Kardanwellen, Auspuff, Lenksäule). */
function rohr(a: [number, number, number], b: [number, number, number], r: number): BufferGeometry {
  const start = new Vector3(...a);
  const ende = new Vector3(...b);
  const g = new CylinderGeometry(r, r, start.distanceTo(ende), 16);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(OBEN, ende.clone().sub(start).normalize()));
  const mitte = start.add(ende).multiplyScalar(0.5);
  return g.translate(mitte.x, mitte.y, mitte.z);
}

/** Flache Scheibe mit beliebiger Ausrichtung (Lenkrad). */
function scheibe(mitte: [number, number, number], richtung: [number, number, number], r: number, h: number) {
  const g = new CylinderGeometry(r, r, h, 36);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(OBEN, new Vector3(...richtung).normalize()));
  return g.translate(...mitte);
}

function platte(form: Shape, tiefe: number): ExtrudeGeometry {
  return new ExtrudeGeometry(form, { depth: tiefe, bevelEnabled: false, curveSegments: 24 });
}

function rechteckLoch(x0: number, y0: number, x1: number, y1: number): Path {
  const p = new Path();
  p.moveTo(x0, y0);
  p.lineTo(x1, y0);
  p.lineTo(x1, y1);
  p.lineTo(x0, y1);
  p.lineTo(x0, y0);
  return p;
}

/** Seitenprofil der Wanne mit Türausschnitt und hinterem Radlauf. */
function wannenProfil(): Shape {
  const s = new Shape();
  s.moveTo(-1.86, 0.62);
  s.lineTo(-1.86, 1.2);
  s.lineTo(-0.5, 1.2);
  s.quadraticCurveTo(-0.44, 0.95, -0.2, 0.95);
  s.lineTo(0.18, 0.95);
  s.quadraticCurveTo(0.4, 0.95, 0.44, 1.2);
  s.lineTo(0.6, 1.28);
  s.lineTo(0.6, 0.62);
  s.lineTo(-0.82, 0.62);
  s.absarc(-1.28, 0.62, 0.46, 0, Math.PI, false);
  s.lineTo(-1.86, 0.62);
  return s;
}

/** Grill mit sieben Schlitzen und zwei Scheinwerferöffnungen (Ansicht von vorn). */
function grillProfil(): Shape {
  const s = new Shape();
  s.moveTo(-0.45, 0.64);
  s.lineTo(0.45, 0.64);
  s.lineTo(0.42, 1.26);
  s.lineTo(-0.42, 1.26);
  s.lineTo(-0.45, 0.64);
  for (let i = 0; i < 7; i++) {
    const z = -0.21 + i * 0.07;
    s.holes.push(rechteckLoch(z - 0.02, 0.8, z + 0.02, 1.14));
  }
  for (const z of [-0.33, 0.33]) {
    const p = new Path();
    p.absarc(z, 1.02, 0.085, 0, Math.PI * 2, false);
    s.holes.push(p);
  }
  return s;
}

function rahmenProfil(breite: number, hoehe: number, staerke: number): Shape {
  const s = new Shape();
  s.moveTo(-breite / 2, 0);
  s.lineTo(breite / 2, 0);
  s.lineTo(breite / 2, hoehe);
  s.lineTo(-breite / 2, hoehe);
  s.lineTo(-breite / 2, 0);
  s.holes.push(rechteckLoch(-breite / 2 + staerke, staerke, breite / 2 - staerke, hoehe - staerke));
  return s;
}

const ACHSE_X = 1.28; // halber Radstand
const RAD_R = 0.38;
const SPUR_Z = 0.65; // halbe Spurweite
const SEITEN = [-1, 1] as const;

export function baueModell(): ModellTeil[] {
  const wanne = platte(wannenProfil(), 1.4).translate(0, 0, -0.7);

  const grill = platte(grillProfil(), 0.03);
  grill.rotateY(Math.PI / 2);
  grill.translate(1.9, 0, 0);

  const scheibenRahmen = platte(rahmenProfil(1.36, 0.46, 0.05), 0.03);
  scheibenRahmen.rotateY(Math.PI / 2);
  scheibenRahmen.rotateZ(0.18);
  scheibenRahmen.translate(0.62, 1.28, 0);

  const raeder: BufferGeometry[] = [];
  for (const x of [ACHSE_X, -ACHSE_X]) {
    for (const z of [SPUR_Z, -SPUR_Z]) {
      raeder.push(zylinder(RAD_R, 0.24, 40, x, RAD_R, z, 'z'), zylinder(0.21, 0.2, 32, x, RAD_R, z, 'z'));
    }
  }

  const bremsen = (x: number) => [zylinder(0.15, 0.08, 32, x, RAD_R, 0.53, 'z'), zylinder(0.15, 0.08, 32, x, RAD_R, -0.53, 'z')];

  return [
    { id: 'wanne', gruppe: 'karosserie', geometrien: [wanne] },
    { id: 'motorhaube', gruppe: 'karosserie', geometrien: [quader(1.25, 0.3, 1.0, 1.24, 1.13, 0)] },
    {
      id: 'kotfluegel',
      gruppe: 'karosserie',
      geometrien: SEITEN.flatMap((s) => [
        quader(1.25, 0.025, 0.3, 1.24, 0.98, s * 0.66),
        quader(0.025, 0.12, 0.3, 1.86, 0.92, s * 0.66),
        quader(0.3, 0.025, 0.3, 0.5, 0.86, s * 0.66, 0.75),
      ]),
    },
    { id: 'kuehlergrill', gruppe: 'karosserie', geometrien: [grill] },
    { id: 'frontscheibe', gruppe: 'karosserie', geometrien: [scheibenRahmen] },
    { id: 'stossstangen', gruppe: 'karosserie', geometrien: [quader(0.1, 0.12, 1.5, 2.02, 0.6, 0), quader(0.08, 0.1, 1.4, -1.92, 0.6, 0)] },
    {
      id: 'sitze',
      gruppe: 'karosserie',
      geometrien: [
        ...SEITEN.flatMap((s) => [quader(0.42, 0.08, 0.42, -0.15, 0.84, s * 0.32), quader(0.06, 0.42, 0.42, -0.4, 1.07, s * 0.32, 0.12)]),
        quader(0.42, 0.08, 0.95, -1.0, 0.84, 0),
        quader(0.06, 0.4, 0.95, -1.24, 1.06, 0, 0.12),
      ],
    },
    { id: 'reserverad', gruppe: 'karosserie', geometrien: [zylinder(0.36, 0.22, 40, -2.03, 0.98, 0, 'x'), zylinder(0.2, 0.18, 32, -2.03, 0.98, 0, 'x')] },

    {
      id: 'motor',
      gruppe: 'antrieb',
      geometrien: [
        quader(0.72, 0.4, 0.32, 1.22, 0.8, 0), // Block
        quader(0.72, 0.12, 0.3, 1.22, 1.06, 0), // Zylinderkopf
        quader(0.66, 0.06, 0.2, 1.22, 1.15, 0.02), // Ventildeckel
        quader(0.6, 0.12, 0.26, 1.22, 0.54, 0), // Ölwanne
        zylinder(0.17, 0.07, 36, 1.3, 1.21, -0.06), // Luftfilter
        zylinder(0.19, 0.02, 32, 1.63, 0.86, 0, 'x'), // Lüfter
      ],
    },
    { id: 'kuehler', gruppe: 'antrieb', geometrien: [quader(0.06, 0.55, 0.72, 1.78, 0.92, 0)] },
    { id: 'getriebe', gruppe: 'antrieb', geometrien: [zylinder(0.15, 0.16, 32, 0.78, 0.78, 0, 'x', 0.2), quader(0.34, 0.22, 0.22, 0.54, 0.74, 0)] },
    { id: 'verteilergetriebe', gruppe: 'antrieb', geometrien: [quader(0.22, 0.3, 0.36, 0.26, 0.66, -0.08)] },
    {
      id: 'kardanwellen',
      gruppe: 'antrieb',
      geometrien: [rohr([0.2, 0.56, -0.2], [ACHSE_X - 0.1, RAD_R, -0.25], 0.03), rohr([0.14, 0.62, 0], [-ACHSE_X + 0.1, RAD_R, 0], 0.035)],
    },

    {
      id: 'rahmen',
      gruppe: 'fahrwerk',
      geometrien: [
        quader(3.5, 0.12, 0.07, 0.05, 0.55, 0.42),
        quader(3.5, 0.12, 0.07, 0.05, 0.55, -0.42),
        ...[1.75, 0.5, -0.7, -1.7].map((x) => quader(0.07, 0.1, 0.77, x, 0.55, 0)),
      ],
    },
    { id: 'vorderachse', gruppe: 'fahrwerk', geometrien: [zylinder(0.045, 1.24, 24, ACHSE_X, RAD_R, 0, 'z'), zylinder(0.13, 0.16, 32, ACHSE_X - 0.02, RAD_R, -0.25, 'x')] },
    { id: 'hinterachse', gruppe: 'fahrwerk', geometrien: [zylinder(0.045, 1.24, 24, -ACHSE_X, RAD_R, 0, 'z'), zylinder(0.13, 0.16, 32, -ACHSE_X + 0.02, RAD_R, 0, 'x')] },
    {
      id: 'blattfedern',
      gruppe: 'fahrwerk',
      geometrien: [ACHSE_X, -ACHSE_X].flatMap((x) => [quader(1.0, 0.04, 0.06, x, 0.45, 0.42), quader(1.0, 0.04, 0.06, x, 0.45, -0.42)]),
    },
    { id: 'bremsen_vorne', gruppe: 'fahrwerk', geometrien: bremsen(ACHSE_X) },
    { id: 'bremsen_hinten', gruppe: 'fahrwerk', geometrien: bremsen(-ACHSE_X) },
    { id: 'raeder', gruppe: 'fahrwerk', geometrien: raeder },
    { id: 'lenkung', gruppe: 'fahrwerk', geometrien: [scheibe([0.1, 1.27, 0.32], [-0.43, 0.5, 0], 0.19, 0.02), rohr([0.55, 0.72, 0.32], [0.12, 1.25, 0.32], 0.02)] },

    { id: 'benzintank', gruppe: 'kraftstoff', geometrien: [quader(0.4, 0.16, 0.4, -0.15, 0.71, 0.32)] },
    { id: 'gastank', gruppe: 'kraftstoff', geometrien: [zylinder(0.17, 0.95, 36, -1.55, 0.88, 0, 'z'), quader(0.08, 0.06, 0.08, -1.55, 1.08, 0.3)] },
    {
      id: 'auspuff',
      gruppe: 'kraftstoff',
      geometrien: [
        rohr([1.0, 0.7, 0.2], [0.8, 0.45, 0.27], 0.025),
        rohr([0.8, 0.45, 0.27], [-0.42, 0.45, 0.27], 0.025),
        zylinder(0.1, 0.55, 32, -0.7, 0.45, 0.27, 'x'),
        rohr([-0.98, 0.45, 0.27], [-1.95, 0.45, 0.27], 0.022),
      ],
    },
  ];
}
