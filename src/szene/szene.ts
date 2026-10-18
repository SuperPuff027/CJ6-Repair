// Imperative three.js-Szene. Die UI spricht nur über SzenenSteuerung mit ihr.
import {
  BufferGeometry,
  EdgesGeometry,
  EllipseCurve,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { passendeEntfernung } from './kamera';
import { baueModell, type ModellTeilId } from './modell';

/** Kanten, deren Flächen weniger als diesen Winkel (Grad) abknicken, werden nicht gezeichnet. */
const KANTEN_SCHWELLE_GRAD = 25;
/** Dünne Linien: WebGL zeichnet 1 Gerätepixel; mehr als 1,5 macht sie auf dem Handy zu blass. */
const MAX_PIXELDICHTE = 1.5;
const BODENKREIS_RADIUS = 2.6;
/** Radius der Kugel um den Jeep, die beim Start ganz ins Bild passen soll (m). */
const MODELL_RADIUS = 2.3;
const BLICKWINKEL_GRAD = 34;

export const START_ANSICHT = {
  kamera: new Vector3(5.2, 2.6, 5.6),
  ziel: new Vector3(0, 0.75, 0),
};

export interface SzenenFarben {
  linie: string;
  linieSchwach: string;
}

export interface SzenenSteuerung {
  setzeFarben(farben: SzenenFarben): void;
  zerstoere(): void;
}

export function erstelleSzene(canvas: HTMLCanvasElement, optionen: { bewegungReduziert: boolean }): SzenenSteuerung {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXELDICHTE));
  renderer.setClearColor(0x000000, 0);

  const szene = new Scene();
  const kamera = new PerspectiveCamera(BLICKWINKEL_GRAD, 1, 0.05, 100);
  kamera.position.copy(START_ANSICHT.kamera);

  const steuerung = new OrbitControls(kamera, canvas);
  steuerung.target.copy(START_ANSICHT.ziel);
  steuerung.enableDamping = true;
  steuerung.dampingFactor = 0.08;
  steuerung.minDistance = 1.2;
  steuerung.maxDistance = 20;
  steuerung.maxPolarAngle = Math.PI * 0.53; // nicht unter den Boden schauen
  steuerung.autoRotate = !optionen.bewegungReduziert;
  steuerung.autoRotateSpeed = 0.45;
  // Bis zur ersten eigenen Bewegung passt sich der Abstand der Bildschirmform an.
  let nutzerHatBewegt = false;
  steuerung.addEventListener('start', () => {
    steuerung.autoRotate = false;
    nutzerHatBewegt = true;
  });

  const linienMaterial = new Map<ModellTeilId, LineBasicMaterial>();
  const geometrien: BufferGeometry[] = [];
  for (const teil of baueModell()) {
    const material = new LineBasicMaterial({ transparent: true });
    linienMaterial.set(teil.id, material);
    for (const geometrie of teil.geometrien) {
      const kanten = new EdgesGeometry(geometrie, KANTEN_SCHWELLE_GRAD);
      geometrien.push(geometrie, kanten);
      const linien = new LineSegments(kanten, material);
      linien.userData.teilId = teil.id;
      szene.add(linien);
    }
  }

  const bodenPunkte = new EllipseCurve(0, 0, BODENKREIS_RADIUS, BODENKREIS_RADIUS)
    .getPoints(120)
    .map((p) => new Vector3(p.x, 0, p.y));
  const bodenGeometrie = new BufferGeometry().setFromPoints(bodenPunkte);
  const bodenMaterial = new LineBasicMaterial();
  szene.add(new LineLoop(bodenGeometrie, bodenMaterial));

  const groesseAnpassen = () => {
    const { clientWidth: breite, clientHeight: hoehe } = canvas;
    if (!breite || !hoehe) return;
    renderer.setSize(breite, hoehe, false);
    kamera.aspect = breite / hoehe;
    kamera.updateProjectionMatrix();
    if (!nutzerHatBewegt) {
      const richtung = kamera.position.clone().sub(steuerung.target).normalize();
      const abstand = passendeEntfernung(kamera.aspect, BLICKWINKEL_GRAD, MODELL_RADIUS);
      kamera.position.copy(steuerung.target).addScaledVector(richtung, abstand);
    }
  };
  const beobachter = new ResizeObserver(groesseAnpassen);
  beobachter.observe(canvas);
  groesseAnpassen();

  let bild = 0;
  const zeichne = () => {
    steuerung.update();
    renderer.render(szene, kamera);
    bild = requestAnimationFrame(zeichne);
  };
  bild = requestAnimationFrame(zeichne);

  return {
    setzeFarben(farben) {
      for (const material of linienMaterial.values()) material.color.set(farben.linie);
      bodenMaterial.color.set(farben.linieSchwach);
    },
    zerstoere() {
      cancelAnimationFrame(bild);
      beobachter.disconnect();
      steuerung.dispose();
      for (const g of geometrien) g.dispose();
      bodenGeometrie.dispose();
      for (const m of linienMaterial.values()) m.dispose();
      bodenMaterial.dispose();
      renderer.dispose();
    },
  };
}
