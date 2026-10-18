// Imperative three.js-Szene. Die UI spricht nur über SzenenSteuerung mit ihr.
import {
  Box3,
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  EllipseCurve,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { istTippen, kleinsterTreffer } from './auswahl';
import { ansichtFuerTeil, passendeEntfernung, sanft, type Vektor } from './kamera';
import { baueModell, type ModellTeilId } from './modell';

/** Kanten, deren Flächen weniger als diesen Winkel (Grad) abknicken, werden nicht gezeichnet. */
const KANTEN_SCHWELLE_GRAD = 25;
/** Dünne Linien: WebGL zeichnet 1 Gerätepixel; mehr als 1,5 macht sie auf dem Handy zu blass. */
const MAX_PIXELDICHTE = 1.5;
const BODENKREIS_RADIUS = 2.6;
/** Radius der Kugel um den Jeep, die in der Gesamtansicht ganz ins Bild passen soll (m). */
const MODELL_RADIUS = 2.3;
const BLICKWINKEL_GRAD = 34;
const FLUGDAUER_MS = 900;
/** Deckkraft der nicht gewählten Bauteile, solange eines gewählt ist. */
const DECKKRAFT_GEDIMMT = 0.2;
/** Leichte rote Füllung des gewählten Bauteils, damit es auch bei vielen Linien hervortritt. */
const DECKKRAFT_FUELLUNG = 0.12;

const START_ZIEL = new Vector3(0, 0.75, 0);
const START_RICHTUNG = new Vector3(5.2, 1.85, 5.6).normalize();

export interface SzenenFarben {
  linie: string;
  linieSchwach: string;
  rot: string;
}

export interface SzenenSteuerung {
  setzeFarben(farben: SzenenFarben): void;
  /**
   * Hebt ein Bauteil hervor und fliegt hin; null zeigt wieder den ganzen Jeep.
   * `linksVerdeckt`: Breite (px), die links vom Menü verdeckt ist; das Teil wird in der freien Fläche gezeigt.
   */
  waehle(id: ModellTeilId | null, linksVerdeckt?: number): void;
  zerstoere(): void;
}

interface TeilDarstellung {
  linien: LineBasicMaterial;
  fuellung: MeshBasicMaterial;
  linienObjekte: LineSegments[];
  huelle: Box3;
  volumen: number;
}

interface Flug {
  vonKamera: Vector3;
  vonZiel: Vector3;
  vonVersatz: number;
  nachKamera: Vector3;
  nachZiel: Vector3;
  nachVersatz: number;
  start: number;
}

export function erstelleSzene(
  canvas: HTMLCanvasElement,
  optionen: { bewegungReduziert: boolean; beiAntippen: (id: ModellTeilId | null) => void },
): SzenenSteuerung {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXELDICHTE));
  renderer.setClearColor(0x000000, 0);

  const szene = new Scene();
  const kamera = new PerspectiveCamera(BLICKWINKEL_GRAD, 1, 0.05, 100);

  const steuerung = new OrbitControls(kamera, canvas);
  steuerung.target.copy(START_ZIEL);
  steuerung.enableDamping = true;
  steuerung.dampingFactor = 0.08;
  steuerung.minDistance = 0.8;
  steuerung.maxDistance = 20;
  steuerung.maxPolarAngle = Math.PI * 0.53; // nicht unter den Boden schauen
  steuerung.autoRotate = !optionen.bewegungReduziert;
  steuerung.autoRotateSpeed = 0.45;

  // Bis zur ersten eigenen Bewegung oder Auswahl passt sich der Abstand der Bildschirmform an.
  let gesamtansichtAnpassen = true;
  let flug: Flug | null = null;
  steuerung.addEventListener('start', () => {
    steuerung.autoRotate = false;
    gesamtansichtAnpassen = false;
    flug = null; // Wer selbst dreht, bricht den Kameraflug ab.
  });

  // ----- Modell -----
  const teile = new Map<ModellTeilId, TeilDarstellung>();
  const flaechen: Mesh[] = [];
  const geometrien: BufferGeometry[] = [];
  for (const teil of baueModell()) {
    const darstellung: TeilDarstellung = {
      linien: new LineBasicMaterial({ transparent: true }),
      // Unsichtbare Flächen zum Antippen; beim gewählten Teil leicht rot gefüllt.
      fuellung: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }),
      linienObjekte: [],
      huelle: new Box3(),
      volumen: 0,
    };
    for (const geometrie of teil.geometrien) {
      const kanten = new EdgesGeometry(geometrie, KANTEN_SCHWELLE_GRAD);
      geometrien.push(geometrie, kanten);
      const linien = new LineSegments(kanten, darstellung.linien);
      darstellung.linienObjekte.push(linien);
      szene.add(linien);
      const flaeche = new Mesh(geometrie, darstellung.fuellung);
      flaeche.userData.teilId = teil.id;
      flaechen.push(flaeche);
      szene.add(flaeche);
      geometrie.computeBoundingBox();
      darstellung.huelle.union(geometrie.boundingBox!);
    }
    const g = darstellung.huelle.getSize(new Vector3());
    darstellung.volumen = g.x * g.y * g.z;
    teile.set(teil.id, darstellung);
  }

  const bodenPunkte = new EllipseCurve(0, 0, BODENKREIS_RADIUS, BODENKREIS_RADIUS)
    .getPoints(120)
    .map((p) => new Vector3(p.x, 0, p.y));
  const bodenGeometrie = new BufferGeometry().setFromPoints(bodenPunkte);
  const bodenMaterial = new LineBasicMaterial();
  szene.add(new LineLoop(bodenGeometrie, bodenMaterial));

  // ----- Darstellung der Auswahl -----
  let farben: SzenenFarben = { linie: '#000', linieSchwach: '#ccc', rot: '#d3261c' };
  let gewaehlt: ModellTeilId | null = null;

  const darstellen = () => {
    for (const [id, d] of teile) {
      const istGewaehlt = id === gewaehlt;
      d.linien.color.set(istGewaehlt ? farben.rot : farben.linie);
      d.linien.opacity = gewaehlt && !istGewaehlt ? DECKKRAFT_GEDIMMT : 1;
      // Das gewählte Teil liegt immer obenauf, auch wenn andere Linien davor verlaufen.
      d.linien.depthTest = !istGewaehlt;
      for (const l of d.linienObjekte) l.renderOrder = istGewaehlt ? 2 : 0;
      d.fuellung.color.set(farben.rot);
      d.fuellung.opacity = istGewaehlt ? DECKKRAFT_FUELLUNG : 0;
    }
    bodenMaterial.color.set(farben.linieSchwach);
  };

  const gesamtansicht = () => {
    const abstand = passendeEntfernung(kamera.aspect, BLICKWINKEL_GRAD, MODELL_RADIUS);
    return { kamera: START_ZIEL.clone().addScaledVector(START_RICHTUNG, abstand), ziel: START_ZIEL.clone() };
  };

  // Verschiebt das Bild nach rechts (px), damit ein gewähltes Teil neben dem offenen Menü erscheint.
  // Ändert sich nur bei einer Auswahl, nie beim Öffnen oder Schließen des Menüs.
  let versatz = 0;
  const wendeVersatzAn = () => {
    const { clientWidth: breite, clientHeight: hoehe } = canvas;
    if (versatz && breite && hoehe) kamera.setViewOffset(breite, hoehe, -versatz, 0, breite, hoehe);
    else kamera.clearViewOffset();
  };

  const fliegeZu = (nachKamera: Vector3, nachZiel: Vector3, nachVersatz: number) => {
    steuerung.autoRotate = false;
    if (optionen.bewegungReduziert) {
      kamera.position.copy(nachKamera);
      steuerung.target.copy(nachZiel);
      versatz = nachVersatz;
      wendeVersatzAn();
      return;
    }
    flug = {
      vonKamera: kamera.position.clone(),
      vonZiel: steuerung.target.clone(),
      vonVersatz: versatz,
      nachKamera,
      nachZiel,
      nachVersatz,
      start: performance.now(),
    };
  };

  // ----- Größe -----
  const groesseAnpassen = () => {
    const { clientWidth: breite, clientHeight: hoehe } = canvas;
    if (!breite || !hoehe) return;
    renderer.setSize(breite, hoehe, false);
    kamera.aspect = breite / hoehe;
    wendeVersatzAn();
    kamera.updateProjectionMatrix();
    if (gesamtansichtAnpassen) {
      const ansicht = gesamtansicht();
      kamera.position.copy(ansicht.kamera);
      steuerung.target.copy(ansicht.ziel);
    }
  };
  const beobachter = new ResizeObserver(groesseAnpassen);
  beobachter.observe(canvas);
  groesseAnpassen();

  // ----- Antippen -----
  const strahl = new Raycaster();
  const zeiger = new Vector2();
  let druckStart: { x: number; y: number } | null = null;
  const beiDruck = (e: PointerEvent) => {
    druckStart = e.isPrimary ? { x: e.clientX, y: e.clientY } : null;
  };
  const beiLoslassen = (e: PointerEvent) => {
    if (!druckStart || !istTippen(druckStart, { x: e.clientX, y: e.clientY })) return;
    druckStart = null;
    const rahmen = canvas.getBoundingClientRect();
    zeiger.set(((e.clientX - rahmen.left) / rahmen.width) * 2 - 1, -((e.clientY - rahmen.top) / rahmen.height) * 2 + 1);
    strahl.setFromCamera(zeiger, kamera);
    const treffer = strahl.intersectObjects(flaechen, false).map((t) => {
      const id = t.object.userData.teilId as ModellTeilId;
      return { id, volumen: teile.get(id)!.volumen };
    });
    optionen.beiAntippen(kleinsterTreffer(treffer));
  };
  canvas.addEventListener('pointerdown', beiDruck);
  canvas.addEventListener('pointerup', beiLoslassen);

  // ----- Zeichnen -----
  let bild = 0;
  const zeichne = (jetzt: number) => {
    if (flug) {
      const t = sanft((jetzt - flug.start) / FLUGDAUER_MS);
      kamera.position.lerpVectors(flug.vonKamera, flug.nachKamera, t);
      steuerung.target.lerpVectors(flug.vonZiel, flug.nachZiel, t);
      versatz = flug.vonVersatz + (flug.nachVersatz - flug.vonVersatz) * t;
      wendeVersatzAn();
      if (t >= 1) flug = null;
    }
    steuerung.update();
    renderer.render(szene, kamera);
    bild = requestAnimationFrame(zeichne);
  };
  bild = requestAnimationFrame(zeichne);

  return {
    setzeFarben(neu) {
      farben = neu;
      darstellen();
    },
    waehle(id, linksVerdeckt = 0) {
      if (id === gewaehlt) return;
      gewaehlt = id;
      gesamtansichtAnpassen = false;
      darstellen();
      if (id) {
        const { clientWidth: breite, clientHeight: hoehe } = canvas;
        const frei = Math.max(breite - linksVerdeckt, breite * 0.3);
        const huelle = teile.get(id)!.huelle;
        const mitte = huelle.getCenter(new Vector3());
        const groesse = huelle.getSize(new Vector3());
        const ansicht = ansichtFuerTeil(mitte.toArray() as Vektor, groesse.toArray() as Vektor, frei / hoehe, BLICKWINKEL_GRAD);
        fliegeZu(new Vector3(...ansicht.kamera), new Vector3(...ansicht.ziel), (breite - frei) / 2);
      } else {
        const ansicht = gesamtansicht();
        fliegeZu(ansicht.kamera, ansicht.ziel, 0);
      }
    },
    zerstoere() {
      cancelAnimationFrame(bild);
      beobachter.disconnect();
      canvas.removeEventListener('pointerdown', beiDruck);
      canvas.removeEventListener('pointerup', beiLoslassen);
      steuerung.dispose();
      for (const g of geometrien) g.dispose();
      bodenGeometrie.dispose();
      for (const d of teile.values()) {
        d.linien.dispose();
        d.fuellung.dispose();
      }
      bodenMaterial.dispose();
      renderer.dispose();
    },
  };
}
