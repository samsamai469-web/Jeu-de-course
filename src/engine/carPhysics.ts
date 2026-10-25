// ============================================================================
// CAR PHYSICS — Modèle dynamique vectoriel (Course + Manœuvres Parking P-R-N-D)
// ============================================================================

import { ShifterPosition } from '../types/game';

export const PHYS_STEP = 1 / 60; // 60 Hz fluide et léger pour le processeur

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ----------------------------------------------------------------------------
// Direction & Géométrie d'Ackermann
// ----------------------------------------------------------------------------

/** Angle de braquage max (degrés) selon la vitesse (km/h) : 38° à basse vitesse pour les créneaux */
export function evalMaxAngleBySpeed(speedKmh: number): number {
  if (speedKmh <= 0) return 38.0;
  if (speedKmh <= 25.0) return lerp(38.0, 34.0, speedKmh / 25.0);
  if (speedKmh <= 60.0) return lerp(34.0, 28.0, (speedKmh - 25.0) / 35.0);
  if (speedKmh <= 120.0) return lerp(28.0, 20.0, (speedKmh - 60.0) / 60.0);
  if (speedKmh <= 200.0) return lerp(20.0, 14.0, (speedKmh - 120.0) / 80.0);
  return lerp(14.0, 9.0, Math.min(1.0, (speedKmh - 200.0) / 140.0));
}

/** Lissage du volant : direct, réactif et retour au centre dynamique */
export function updateCarSteerAngle(
  currentAngleDeg: number,
  steerInput: number,
  speedKmh: number,
  dt: number,
  sensitivity = 1.0,
  steerRate = 190.0,
  returnRate = 320.0,
  highSpeedDamping = 0.35,
  highSpeedKmh = 220.0
): number {
  const maxAngle = evalMaxAngleBySpeed(speedKmh) * sensitivity;
  const target = clamp(steerInput * maxAngle, -maxAngle, maxAngle);

  const returning =
    Math.abs(steerInput) < 0.01 || Math.sign(steerInput) !== Math.sign(currentAngleDeg);

  const speedFactor = lerp(1.0, 1.0 - highSpeedDamping, clamp(speedKmh / highSpeedKmh, 0, 1));
  const rate = (returning ? returnRate : steerRate) * speedFactor;

  const diff = target - currentAngleDeg;
  if (Math.abs(diff) <= rate * dt) return target;
  return currentAngleDeg + Math.sign(diff) * rate * dt;
}

/** Contre-braquage automatique : aide la voiture à se stabiliser sans bloquer */
export function computeCounterSteer(
  slipAngleDeg: number,
  speedMs: number,
  isReversing: boolean,
  counterSteerAssist = 0.30,
  assistMinSpeed = 10.0 / 3.6,
  assistMaxCorrection = 18.0
): number {
  if (counterSteerAssist <= 0 || speedMs < assistMinSpeed || isReversing) return 0;
  return clamp(slipAngleDeg, -assistMaxCorrection, assistMaxCorrection) * counterSteerAssist;
}

/** Géométrie d'Ackermann : angle intérieur plus fort pour une vraie trajectoire */
export function applyAckermann(
  angleDeg: number,
  wheelBase = 2.6,
  trackWidth = 1.5
): { leftDeg: number; rightDeg: number; avgRad: number } {
  const limit = evalMaxAngleBySpeed(0);
  const a = clamp(angleDeg, -limit, limit);

  if (Math.abs(a) < 0.01) return { leftDeg: 0, rightDeg: 0, avgRad: 0 };

  const radius = wheelBase / Math.tan(Math.abs(a) * DEG);
  const half = trackWidth * 0.5;
  const innerRad = Math.atan(wheelBase / Math.max(radius - half, 0.01));
  const outerRad = Math.atan(wheelBase / (radius + half));
  const innerDeg = innerRad * RAD;
  const outerDeg = outerRad * RAD;

  if (a > 0) {
    return { leftDeg: outerDeg, rightDeg: innerDeg, avgRad: (innerRad + outerRad) * 0.5 };
  }
  return { leftDeg: -innerDeg, rightDeg: -outerDeg, avgRad: -(innerRad + outerRad) * 0.5 };
}

// ----------------------------------------------------------------------------
// Dynamique & Vitesse (Supportant Boîte P-R-N-D et Frein à main)
// ----------------------------------------------------------------------------

export interface CarDynState {
  x: number;
  z: number;
  heading: number;
  speedMs: number;
  lateralVel: number;
  yawRate: number;
  steerAngleDeg: number;
  frontLeftSteerDeg: number;
  frontRightSteerDeg: number;
  steerAngle: number;
  slipAngleDeg: number;
  drifting: boolean;
}

export interface CarDynInput {
  steerInput: number;
  throttle: boolean;
  brake: boolean;
  canDrive: boolean;
  nitroActive: boolean;
  sensitivity: number;
  gripFactor: number;
  maxSpeedMs: number;
  acceleration: number;
  braking: number;
  handling: number;
  offRoad: boolean;
  shifterPos?: ShifterPosition;
  handbrake?: boolean;
  engineRunning?: boolean;
  outOfFuel?: boolean;
  parkingMode?: boolean;
}

export const CAR_TUNING = {
  wheelBase: 2.6,
  maxLateralAccel: 40.0,
  yawResponse: 18.0,
  yawResponseDrift: 8.0,
  tireGrip: 15.0,
  driftGripFactor: 0.35,
  slideScrub: 0.012,
  yawGain: 0.62,
};

export function stepCarDynamics(s: CarDynState, i: CarDynInput, h: number): void {
  const T = CAR_TUNING;
  const speedAbs = Math.abs(s.speedMs);
  const speedKmh = speedAbs * 3.6;
  const shifter = i.shifterPos || 'D';
  const engineOn = i.engineRunning !== false && !i.outOfFuel;
  const isReversing = s.speedMs < -0.08 || shifter === 'R';

  // --- 1. Volant ---
  s.steerAngleDeg = updateCarSteerAngle(s.steerAngleDeg, i.steerInput, speedKmh, h, i.sensitivity);
  const counter = computeCounterSteer(s.slipAngleDeg, speedAbs, isReversing);
  const ack = applyAckermann(s.steerAngleDeg + counter, T.wheelBase);
  s.frontLeftSteerDeg = ack.leftDeg;
  s.frontRightSteerDeg = ack.rightDeg;
  s.steerAngle = ack.avgRad;

  // --- 2. Dérapage (Frein à main ou freinage appuyé en courbe) ---
  s.drifting =
    Math.abs(i.steerInput) > 0.45 && speedAbs > 12 && (i.brake || Boolean(i.handbrake));

  // --- 3. Propulsion & Boîte P / R / N / D ---
  if (!i.canDrive) {
    const holdDecel = i.braking * 1.65;
    if (Math.abs(s.speedMs) <= holdDecel * h) {
      s.speedMs = 0;
    } else {
      s.speedMs -= Math.sign(s.speedMs) * holdDecel * h;
    }
  } else if (i.throttle) {
    // Pédale AVANCER / GAZ (ou Flèche Haut / W / Z) :
    // Priorité absolue à la marche AVANT (ne recule jamais quand on veut avancer)
    if (s.speedMs < -0.15) {
      // Freine rapidement le recul avant de repartir vers l'avant
      s.speedMs = Math.min(0, s.speedMs + i.braking * 2.4 * h);
    } else {
      const parkingScale = i.parkingMode && s.speedMs < 5.0 ? 0.78 : 1.0;
      const power =
        i.acceleration *
        parkingScale *
        (i.nitroActive ? 1.75 : 1.22) *
        Math.max(0.82, i.gripFactor);
      const ratio = Math.max(0, s.speedMs) / Math.max(1, i.maxSpeedMs);
      const torque = Math.max(0.68, 1.0 - Math.pow(ratio, 1.4) * 0.32);
      s.speedMs = Math.min(i.maxSpeedMs, Math.max(0, s.speedMs) + power * torque * h);
    }
  } else if (i.brake) {
    // Pédale FREIN / RECUL (ou Flèche Bas / S) :
    // Freine si la voiture avance, puis engage la marche arrière une fois arrêtée
    if (s.speedMs > 0.25) {
      const brakeScale = s.drifting ? 0.65 : 1.25;
      s.speedMs = Math.max(0, s.speedMs - i.braking * i.gripFactor * 1.35 * brakeScale * h);
    } else {
      const revAccel = i.acceleration * (i.parkingMode ? 0.55 : 0.75);
      const maxRevMs = i.parkingMode ? 10.0 : 16.0;
      s.speedMs = Math.max(-maxRevMs, s.speedMs - revAccel * h);
    }
  } else if (shifter === 'P' || i.handbrake) {
    // Frein de parking (P) ou Frein à main serré sans appuyer sur les pédales
    const holdDecel = i.braking * 1.65;
    if (Math.abs(s.speedMs) <= holdDecel * h) {
      s.speedMs = 0;
    } else {
      s.speedMs -= Math.sign(s.speedMs) * holdDecel * h;
    }
  } else if (shifter === 'N' || !engineOn) {
    // Point mort (N) ou moteur coupé : roue libre
    const drag = (0.28 + 0.0005 * s.speedMs * s.speedMs) * (i.offRoad ? 2.0 : 1.0);
    s.speedMs *= Math.exp(-drag * h);
    if (Math.abs(s.speedMs) < 0.03) s.speedMs = 0;
  } else {
    // Roue libre en D ou R
    const drag = (0.24 + 0.0005 * s.speedMs * s.speedMs) * (i.offRoad ? 2.0 : 1.0);
    s.speedMs *= Math.exp(-drag * h);
    if (Math.abs(s.speedMs) < 0.03) s.speedMs = 0;
  }

  // --- 4. Rotation de la caisse (Yaw Rate) ---
  // À basse vitesse (créneau < 25 km/h), on utilise la cinématique pure d'Ackermann sans sous-virage
  const lowSpeedPureAckermann = speedKmh < 28 ? 1.0 : T.yawGain * (i.handling / 3.0);
  const wanted = -(s.speedMs / T.wheelBase) * Math.tan(s.steerAngle) * (speedKmh < 28 ? 1.05 : i.handling * T.yawGain);
  const maxLat = T.maxLateralAccel * (i.handling / 3.0) * Math.max(0.4, i.gripFactor);
  const yawLimit = speedKmh < 28 ? 2.6 : maxLat / Math.max(3.0, Math.abs(s.speedMs));
  const target = clamp(wanted * (lowSpeedPureAckermann > 0.9 ? 1.0 : 1.0), -yawLimit, yawLimit);

  const response = s.drifting ? T.yawResponseDrift : T.yawResponse;
  s.yawRate += (target - s.yawRate) * (1 - Math.exp(-response * h));
  if (Math.abs(s.speedMs) < 0.02) s.yawRate = 0;
  s.heading += s.yawRate * h;

  // --- 5. Adhérence latérale & Glisse ---
  const vx = s.speedMs;
  let vy = s.lateralVel;
  vy += vx * s.yawRate * h;

  const grip = T.tireGrip * Math.max(0.4, i.gripFactor) * (s.drifting ? T.driftGripFactor : 1.0);
  vy *= Math.exp(-grip * h);
  vy = clamp(vy, -Math.max(2, speedAbs * 0.8), Math.max(2, speedAbs * 0.8));
  if (speedAbs < 0.1) vy = 0;
  s.lateralVel = vy;

  if (Math.abs(vy) > 1.2) {
    s.speedMs *= Math.exp(-T.slideScrub * Math.abs(vy) * h);
  }

  s.slipAngleDeg = Math.atan2(vy, Math.max(1.0, Math.abs(s.speedMs))) * RAD;

  // --- 6. Intégration dans le monde ---
  const sinH = Math.sin(s.heading);
  const cosH = Math.cos(s.heading);
  const fwdX = -sinH;
  const fwdZ = -cosH;
  const rightX = cosH;
  const rightZ = -sinH;
  s.x += (fwdX * s.speedMs + rightX * s.lateralVel) * h;
  s.z += (fwdZ * s.speedMs + rightZ * s.lateralVel) * h;
}

export function stepCarDynamicsSubsteps(s: CarDynState, i: CarDynInput, dt: number): void {
  const steps = Math.min(2, Math.max(1, Math.round(dt / PHYS_STEP)));
  const h = dt / steps;
  for (let k = 0; k < steps; k++) stepCarDynamics(s, i, h);
}
