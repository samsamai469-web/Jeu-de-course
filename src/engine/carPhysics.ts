// ============================================================================
// CAR PHYSICS — modèle à vitesse vectorielle (avant + latérale)
// ----------------------------------------------------------------------------
// Module pur : aucune dépendance à Three.js ni à React, donc testable seul.
//
// Principe :
//  - la voiture a une vitesse AVANT (speedMs) et une vitesse LATÉRALE (lateralVel)
//    exprimées dans son propre repère ;
//  - le volant (angle d'Ackermann) demande une vitesse de rotation (yaw rate) ;
//  - cette rotation est LIMITÉE par l'adhérence disponible (sous-virage) ;
//  - quand la voiture tourne, sa vitesse "glisse" latéralement et les pneus
//    la ramènent vers zéro avec une force proportionnelle à l'adhérence ;
//  - frein + volant à haute vitesse = adhérence réduite = vrai dérapage.
//
// Conventions (identiques au jeu) :
//  - heading : 0 = vers -Z, positif = tourne à gauche
//  - avant  = (-sin h, -cos h)      droite = (cos h, -sin h)
//  - steerInput / angles de volant : positif = droite
//  - lateralVel : positif = la voiture glisse vers sa droite
// ============================================================================

export const PHYS_STEP = 1 / 120; // pas de simulation maximal (s)

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ----------------------------------------------------------------------------
// Direction
// ----------------------------------------------------------------------------

/** Angle de braquage max (degrés) selon la vitesse (km/h). */
export function evalMaxAngleBySpeed(speedKmh: number): number {
  if (speedKmh <= 0) return 35.0;
  if (speedKmh <= 60.0) return lerp(35.0, 22.0, speedKmh / 60.0);
  if (speedKmh <= 120.0) return lerp(22.0, 10.0, (speedKmh - 60.0) / 60.0);
  if (speedKmh <= 200.0) return lerp(10.0, 5.0, (speedKmh - 120.0) / 80.0);
  return lerp(5.0, 3.8, Math.min(1.0, (speedKmh - 200.0) / 140.0));
}

/** Lissage du volant : rotation progressive, retour au centre plus rapide. */
export function updateCarSteerAngle(
  currentAngleDeg: number,
  steerInput: number,
  speedKmh: number,
  dt: number,
  sensitivity = 1.0,
  steerRate = 150.0,
  returnRate = 280.0,
  highSpeedDamping = 0.5,
  highSpeedKmh = 180.0
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

/** Contre-braquage automatique : on braque vers la direction réelle du déplacement. */
export function computeCounterSteer(
  slipAngleDeg: number,
  speedMs: number,
  isReversing: boolean,
  counterSteerAssist = 0.35,
  assistMinSpeed = 8.0 / 3.6,
  assistMaxCorrection = 20.0
): number {
  if (counterSteerAssist <= 0 || speedMs < assistMinSpeed || isReversing) return 0;
  return clamp(slipAngleDeg, -assistMaxCorrection, assistMaxCorrection) * counterSteerAssist;
}

/** Géométrie d'Ackermann : la roue intérieure braque plus que l'extérieure. */
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
// Dynamique
// ----------------------------------------------------------------------------

/** État modifié par la physique (l'objet `phys` du jeu satisfait cette interface). */
export interface CarDynState {
  x: number;
  z: number;
  heading: number;
  speedMs: number; // vitesse avant (négative en marche arrière)
  lateralVel: number; // vitesse latérale réelle (positive = vers la droite)
  yawRate: number; // rad/s, positif = vers la gauche
  steerAngleDeg: number;
  frontLeftSteerDeg: number;
  frontRightSteerDeg: number;
  steerAngle: number; // rad, moyenne Ackermann
  slipAngleDeg: number;
  drifting: boolean;
}

export interface CarDynInput {
  steerInput: number; // -1..1
  throttle: boolean;
  brake: boolean;
  canDrive: boolean;
  nitroActive: boolean;
  sensitivity: number;
  gripFactor: number; // surface × appui aéro
  maxSpeedMs: number;
  acceleration: number; // carSpec.acceleration
  braking: number; // carSpec.braking
  handling: number; // carSpec.handling
  offRoad: boolean; // accotement
}

/** Réglages de comportement (modifiables pour affiner le feeling). */
export const CAR_TUNING = {
  wheelBase: 2.6,
  /** Accélération latérale max (m/s²) pour handling = 3.0 et grip = 1. */
  maxLateralAccel: 26.0,
  /** Réactivité de la rotation de caisse (1/s) : plus haut = plus nerveux. */
  yawResponse: 14.0,
  yawResponseDrift: 6.0,
  /** Force de rappel des pneus sur la vitesse latérale (1/s) à grip = 1. */
  tireGrip: 9.0,
  /** Multiplicateur d'adhérence en dérapage contrôlé (frein + volant). */
  driftGripFactor: 0.28,
  /** Perte de vitesse due au glissement (1/s par m/s de glissement). */
  slideScrub: 0.06,
  /** Multiplicateur historique du taux de rotation (compatibilité avec l'ancien feeling). */
  yawGain: 0.52,
};

/**
 * Avance la voiture de `h` secondes. À appeler plusieurs fois par image avec un
 * `h` ≤ PHYS_STEP pour une simulation indépendante du nombre d'images par seconde.
 */
export function stepCarDynamics(s: CarDynState, i: CarDynInput, h: number): void {
  const T = CAR_TUNING;
  const speedAbs = Math.abs(s.speedMs);
  const speedKmh = speedAbs * 3.6;
  const isReversing = s.speedMs < -0.1 || (i.brake && s.speedMs < 0.2);

  // --- 1. Volant (lissage + contre-braquage + Ackermann) --------------------
  s.steerAngleDeg = updateCarSteerAngle(s.steerAngleDeg, i.steerInput, speedKmh, h, i.sensitivity);
  const counter = computeCounterSteer(s.slipAngleDeg, speedAbs, isReversing);
  const ack = applyAckermann(s.steerAngleDeg + counter, T.wheelBase);
  s.frontLeftSteerDeg = ack.leftDeg;
  s.frontRightSteerDeg = ack.rightDeg;
  s.steerAngle = ack.avgRad;

  // --- 2. Dérapage contrôlé (frein + gros angle à haute vitesse) ------------
  s.drifting = Math.abs(i.steerInput) > 0.55 && speedAbs > 18 && i.brake;

  // --- 3. Longitudinal : accélération, freinage, marche arrière, traînée ----
  if (i.canDrive && i.throttle && !i.brake) {
    const power = i.acceleration * (i.nitroActive ? 1.6 : 1.0) * Math.max(0.72, i.gripFactor);
    const ratio = Math.max(0, s.speedMs) / Math.max(1, i.maxSpeedMs);
    const torque = Math.max(0.42, 1.0 - Math.pow(ratio, 1.8) * 0.58);
    s.speedMs = Math.min(i.maxSpeedMs, s.speedMs + power * torque * h);
  } else if (i.canDrive && i.brake) {
    if (s.speedMs > 0.4) {
      const brakeScale = s.drifting ? 0.55 : 1.0; // on freine moins fort en glissant
      s.speedMs = Math.max(0, s.speedMs - i.braking * i.gripFactor * 1.35 * brakeScale * h);
    } else {
      s.speedMs = Math.max(-18, s.speedMs - i.acceleration * 0.85 * h);
    }
  } else {
    const drag = (0.36 + 0.001 * s.speedMs * s.speedMs) * (i.offRoad ? 2.2 : 1.0);
    s.speedMs *= Math.exp(-drag * h);
  }

  // --- 4. Rotation demandée, limitée par l'adhérence (sous-virage) ----------
  const wanted = -(s.speedMs / T.wheelBase) * Math.tan(s.steerAngle) * i.handling * T.yawGain;

  const maxLat = T.maxLateralAccel * (i.handling / 3.0) * Math.max(0.35, i.gripFactor);
  const yawLimit = maxLat / Math.max(2.0, Math.abs(s.speedMs));
  const target = clamp(wanted, -yawLimit, yawLimit);

  const response = s.drifting ? T.yawResponseDrift : T.yawResponse;
  s.yawRate += (target - s.yawRate) * (1 - Math.exp(-response * h));
  s.heading += s.yawRate * h;

  // --- 5. Vitesse latérale : la rotation la crée, les pneus la ramènent à 0 -
  const vx = s.speedMs;
  let vy = s.lateralVel;
  vy += vx * s.yawRate * h; // la caisse tourne, la vitesse monde reste
  s.speedMs -= vy * s.yawRate * h; // même rotation vue côté avant

  const grip = T.tireGrip * Math.max(0.35, i.gripFactor) * (s.drifting ? T.driftGripFactor : 1.0);
  vy *= Math.exp(-grip * h);
  vy = clamp(vy, -Math.max(2, speedAbs * 0.9), Math.max(2, speedAbs * 0.9));
  s.lateralVel = vy;

  // Glisser coûte de la vitesse.
  s.speedMs *= Math.exp(-T.slideScrub * Math.abs(vy) * h);

  s.slipAngleDeg = Math.atan2(vy, Math.max(1.0, Math.abs(s.speedMs))) * RAD;

  // --- 6. Intégration de la position dans le repère monde -------------------
  const sinH = Math.sin(s.heading);
  const cosH = Math.cos(s.heading);
  const fwdX = -sinH;
  const fwdZ = -cosH;
  const rightX = cosH;
  const rightZ = -sinH;
  s.x += (fwdX * s.speedMs + rightX * s.lateralVel) * h;
  s.z += (fwdZ * s.speedMs + rightZ * s.lateralVel) * h;
}

/** Découpe `dt` en sous-pas fixes et avance la voiture. */
export function stepCarDynamicsSubsteps(s: CarDynState, i: CarDynInput, dt: number): void {
  const steps = Math.max(1, Math.ceil(dt / PHYS_STEP));
  const h = dt / steps;
  for (let k = 0; k < steps; k++) stepCarDynamics(s, i, h);
}
