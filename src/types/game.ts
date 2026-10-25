export type GameMode = 'race' | 'time_attack' | 'free_drive' | 'exploration' | 'parking';

export type ScreenState =
  | 'main_menu'
  | 'car_select'
  | 'track_select'
  | 'garage'
  | 'settings'
  | 'playing'
  | 'paused'
  | 'finished';

export type QualityPreset = 'auto' | 'high' | 'medium' | 'low';
export type TimeOfDay = 'morning' | 'afternoon' | 'sunset' | 'night';
export type WeatherType = 'clear' | 'rain' | 'fog' | 'snow';
export type TransmissionType = 'auto' | 'manual';
export type ShifterPosition = 'P' | 'R' | 'N' | 'D';
export type DrivingStyle = 'grip' | 'balanced' | 'drift';
export type TrafficDensity = 'off' | 'light' | 'dense';
export type CameraMode = 'chase_near' | 'chase_far' | 'hood' | 'cockpit' | 'top_parking' | 'orbit_360';
export type PaintFinish = 'metallic' | 'matte' | 'chrome';
export type RimStyle = 'amg_multi' | 'gt_five_spoke' | 'bbs_mesh' | 'aero_turbine';
export type BodyKitType = 'stock' | 'sport_aero' | 'gt3_widebody';
export type EngineSwapType = 'stock' | 'v6_35' | 'v8_40_biturbo' | 'v10_52' | 'w16_80_quad';
export type TrackBiome = 'savannah' | 'alpine' | 'countryside' | 'coastal' | 'canyon' | 'snow' | 'tropical' | 'volcano';
export type MedalTier = 'none' | 'bronze' | 'silver' | 'gold';

export interface CarSpec {
  id: string;
  name: string;
  category: string;
  tagline: string;
  maxSpeedKmh: number;
  acceleration: number; // m/s^2 factor
  handling: number; // rad/s factor
  braking: number;
  baseHp?: number;
  baseNm?: number;
  defaultColor: string;
  defaultRimColor: string;
  bodyStyle: 'street' | 'gt' | 'hyper' | 'muscle';
  stats: {
    speed: number; // 0-100
    accel: number; // 0-100
    handling: number; // 0-100
    braking: number; // 0-100
  };
}

export interface CarPerformanceUpgrades {
  engineLevel: 1 | 2 | 3;
  turboLevel: 1 | 2 | 3;
  tiresLevel: 1 | 2 | 3;
  brakesLevel: 1 | 2 | 3;
  engineSwap?: EngineSwapType;
  ecuStage?: 1 | 2 | 3;
  exhaustSport?: boolean;
}

export interface CarCustomization {
  bodyColor: string;
  rimColor: string;
  rimStyle: RimStyle;
  bodyKit: BodyKitType;
  finish: PaintFinish;
  headlightColor: string;
  neonUnderglow: boolean;
  // Car Parking Multiplayer Suspension & Exterior Extensions
  rideHeight?: number; // -0.06 to +0.06 meters
  camberAngleDeg?: number; // 0 to -12 degrees
  wheelOffset?: number; // 0 to +0.06 meters
  windowTintOpacity?: number; // 0.25 to 0.92
  tireSmokeColor?: string; // Hex color for drift/burnout smoke
}

export interface ParkingChallengeSpec {
  id: number;
  title: string;
  subtitle: string;
  rewardMoney: number;
  difficulty: 'Facile' | 'Moyen' | 'Expert';
  description: string;
  startForwardDist: number;
  startLatOffset: number;
  startHeadingOffset: number;
  bayForwardDist: number;
  bayLatOffset: number;
  bayHeadingOffset: number; // 0 = parallel, Math.PI/2 = perpendicular bay, Math.PI = reverse parallel
  reverseRequired?: boolean;
  cones: Array<{ fwd: number; lat: number }>;
}

export const PARKING_CHALLENGES: ParkingChallengeSpec[] = [
  {
    id: 1,
    title: 'Défi 1 · Stationnement Direct Avancé',
    subtitle: 'Alignez la voiture dans la zone [P] entre les cônes et passez en P',
    rewardMoney: 2500,
    difficulty: 'Facile',
    description: 'Avancez prudemment dans le couloir balisé et immobilisez le véhicule au centre du marquage vert.',
    startForwardDist: 0,
    startLatOffset: 2.5,
    startHeadingOffset: 0,
    bayForwardDist: 38,
    bayLatOffset: 2.5,
    bayHeadingOffset: 0,
    cones: [
      { fwd: 14, lat: -0.2 },
      { fwd: 14, lat: 5.2 },
      { fwd: 24, lat: -0.2 },
      { fwd: 24, lat: 5.2 },
      { fwd: 34, lat: -0.2 },
      { fwd: 34, lat: 5.2 },
      { fwd: 43, lat: -0.2 },
      { fwd: 43, lat: 5.2 },
      { fwd: 44, lat: 2.5 },
    ],
  },
  {
    id: 2,
    title: 'Défi 2 · Créneau Urbain Latéral',
    subtitle: 'Déboîtez sur la voie de droite et garez-vous le long du trottoir',
    rewardMoney: 3500,
    difficulty: 'Facile',
    description: 'Changez de file entre les cônes de travaux et stabilisez la voiture dans l’emplacement latéral.',
    startForwardDist: 0,
    startLatOffset: -2.6,
    startHeadingOffset: 0,
    bayForwardDist: 46,
    bayLatOffset: 3.4,
    bayHeadingOffset: 0,
    cones: [
      { fwd: 16, lat: -5.2 },
      { fwd: 16, lat: 0.2 },
      { fwd: 28, lat: 0.2 },
      { fwd: 28, lat: 6.0 },
      { fwd: 39, lat: 3.4 },
      { fwd: 42, lat: 6.0 },
      { fwd: 50, lat: 6.0 },
      { fwd: 53, lat: 3.4 },
    ],
  },
  {
    id: 3,
    title: 'Défi 3 · Marche Arrière de Précision (R)',
    subtitle: 'Engagez la marche arrière [R] et reculez droit dans le box',
    rewardMoney: 4500,
    difficulty: 'Moyen',
    description: 'Passez le levier sur R, utilisez le rétroviseur ou la caméra vue de dessus et reculez entre les cônes.',
    startForwardDist: 36,
    startLatOffset: -2.2,
    startHeadingOffset: 0,
    bayForwardDist: 8,
    bayLatOffset: 2.6,
    bayHeadingOffset: 0,
    reverseRequired: true,
    cones: [
      { fwd: 28, lat: 0.2 },
      { fwd: 20, lat: 0.2 },
      { fwd: 14, lat: 0.0 },
      { fwd: 14, lat: 5.2 },
      { fwd: 8, lat: 0.0 },
      { fwd: 8, lat: 5.2 },
      { fwd: 2, lat: 0.0 },
      { fwd: 2, lat: 5.2 },
      { fwd: 1.5, lat: 2.6 },
    ],
  },
  {
    id: 4,
    title: 'Défi 4 · Slalom Technique & Arrêt Box',
    subtitle: 'Contournez les 4 chicanes de cônes sans en toucher un seul',
    rewardMoney: 5500,
    difficulty: 'Moyen',
    description: 'Maintenez une allure maîtrisée à travers le slalom puis immobilisez la voiture dans la zone finale.',
    startForwardDist: 0,
    startLatOffset: -2.8,
    startHeadingOffset: 0,
    bayForwardDist: 72,
    bayLatOffset: 2.8,
    bayHeadingOffset: 0,
    cones: [
      { fwd: 18, lat: -2.8 },
      { fwd: 18, lat: -5.4 },
      { fwd: 34, lat: 2.8 },
      { fwd: 34, lat: 5.4 },
      { fwd: 50, lat: -2.8 },
      { fwd: 50, lat: -5.4 },
      { fwd: 66, lat: 0.2 },
      { fwd: 66, lat: 5.4 },
      { fwd: 78, lat: 2.8 },
    ],
  },
  {
    id: 5,
    title: 'Défi 5 · Stationnement en Bataille 90°',
    subtitle: 'Braquez à fond à 38° pour entrer perpendiculairement dans la loge',
    rewardMoney: 6500,
    difficulty: 'Expert',
    description: 'Ouvrez votre angle d’approche et alignez la voiture à 90° dans la place de parking en bataille.',
    startForwardDist: 0,
    startLatOffset: -3.2,
    startHeadingOffset: 0,
    bayForwardDist: 36,
    bayLatOffset: 3.8,
    bayHeadingOffset: -Math.PI / 2,
    cones: [
      { fwd: 22, lat: -6.0 },
      { fwd: 32, lat: 1.0 },
      { fwd: 32, lat: 6.4 },
      { fwd: 40, lat: 1.0 },
      { fwd: 40, lat: 6.4 },
      { fwd: 36, lat: 6.8 },
    ],
  },
  {
    id: 6,
    title: 'Défi 6 · Examen Maître Demi-Tour 180°',
    subtitle: 'Effectuez une manœuvre 3-points et garez-vous face au départ',
    rewardMoney: 8000,
    difficulty: 'Expert',
    description: 'Combinez marche avant (D) et marche arrière (R) pour retourner la voiture à 180° dans la zone.',
    startForwardDist: 0,
    startLatOffset: -2.5,
    startHeadingOffset: 0,
    bayForwardDist: 34,
    bayLatOffset: 2.8,
    bayHeadingOffset: Math.PI,
    cones: [
      { fwd: 16, lat: -6.2 },
      { fwd: 16, lat: 6.2 },
      { fwd: 28, lat: -6.2 },
      { fwd: 28, lat: 6.2 },
      { fwd: 42, lat: -6.2 },
      { fwd: 42, lat: 6.2 },
      { fwd: 46, lat: 0.0 },
      { fwd: 46, lat: 2.8 },
      { fwd: 46, lat: -2.8 },
    ],
  },
];

export interface TrackSpec {
  id: string;
  levelNumber: number;
  name: string;
  subtitle: string;
  location: string;
  lengthKm: number;
  defaultLaps: number;
  aiCount?: number;
  aiSpeedFactor?: number;
  aiAggression?: number;
  difficulty: 'Facile' | 'Intermédiaire' | 'Expert';
  defaultTimeOfDay: TimeOfDay;
  defaultWeather: WeatherType;
  roadWidth: number;
  theme: 'city' | 'circuit' | 'coastal';
  biome: TrackBiome;
  isStraight?: boolean;
  targetGoldSec: number;
  targetSilverSec: number;
  targetBronzeSec: number;
  challengeText: string;
  description: string;
  waypoints: Array<[number, number, number]>;
}

export interface GameSettings {
  quality: QualityPreset;
  timeOfDay: TimeOfDay;
  dynamicDayNight: boolean;
  dayNightSpeed: number; // 1 = normal, 2 = fast, 4 = timelapse
  weather: WeatherType;
  transmission: TransmissionType;
  drivingStyle: DrivingStyle;
  absEspEnabled: boolean;
  cameraFovOffset: number; // -8 to +12 degrees
  cameraDistanceOffset: number; // -1.2 to +2.0 meters
  rearViewMirror: boolean;
  aiCount: number; // 1 to 7
  trafficDensity: TrafficDensity;
  soundEnabled: boolean;
  volume: number;
  touchControlsMode: 'auto' | 'always' | 'off';
  steeringSensitivity: number;
  cameraMode: CameraMode;
  aiDifficulty: 'normal' | 'pro' | 'legend';
}

export interface PlayerProgress {
  xp: number;
  driverLevel: number;
  unlockedLevels: number; // 1..5
  money?: number; // Crédits ($) Car Parking Multiplayer
  parkingStars?: Record<number, 0 | 1 | 2 | 3>;
  unlockedParkingLevel?: number;
  stars: Record<string, 0 | 1 | 2 | 3>;
  medals: Record<string, MedalTier>;
  bestLapTimes: Record<string, number | null>;
  bestTotalTimes: Record<string, number | null>;
  completedChallenges: Record<string, boolean>;
}

export interface RearOpponentInfo {
  name: string;
  color: string;
  lateralOffset: number; // -1 (left) to +1 (right) in mirror
  distanceMeters: number; // positive distance behind player
}

export interface RacerStanding {
  rank: number;
  name: string;
  color: string;
  isPlayer: boolean;
  finished: boolean;
  finishTime: number | null;
}

export interface TelemetryState {
  speedKmh: number;
  rpm: number; // 1000 - 8500
  gear: number; // -1 = R, 0 = N, 1..6
  shifterPos?: ShifterPosition;
  handbrakePulled?: boolean;
  leftSignal?: boolean;
  rightSignal?: boolean;
  hazardLights?: boolean;
  engineRunning?: boolean;
  fuelPercent?: number;
  nearGasStation?: boolean;
  refueling?: boolean;
  isWalking?: boolean;
  parkingChallengeIndex?: number;
  parkingStatus?: 'approaching' | 'inside' | 'aligned' | 'parked_success' | 'cone_hit';
  parkingProgressPct?: number;
  parkingDistanceMeters?: number;
  lap: number;
  totalLaps: number;
  elapsedTime: number;
  currentLapTime: number;
  bestLapTime: number | null;
  position: number;
  totalRacers: number;
  countdown: number; // 3, 2, 1, 0 (GO), -1 (active)
  raceFinished?: boolean;
  standings?: RacerStanding[];
  nitroAmount: number; // 0 - 100
  nitroActive: boolean;
  drifting: boolean;
  steerRatio: number; // -1 (left) to +1 (right) for visual wheel sync
  surfaceType: 'asphalt' | 'kerb' | 'shoulder';
  gripPercent: number;
  headlightsOn: boolean;
  dayTimeHours: number; // 0..24 continuous clock for dynamic day/night cycle
  lookingBack: boolean;
  discoveredPoints: number;
  totalDiscoveryPoints: number;
  lastCheckpointBanner: string | null;
  fps: number;
  activeQualityTier: 'high' | 'medium' | 'low';
  minimapPoints: Array<{ x: number; z: number }>;
  playerPos: { x: number; z: number; heading: number };
  opponentsPos: Array<{ x: number; z: number; color: string; name: string }>;
  rearOpponents: RearOpponentInfo[];
  discoveryBeacons: Array<{ x: number; z: number; collected: boolean; label: string }>;
}

export const CAMERA_LABELS: Record<CameraMode, string> = {
  chase_near: 'Arrière Rapprochée',
  chase_far: 'Arrière Éloignée',
  hood: 'Vue Capot',
  cockpit: 'Vue Habitacle',
  top_parking: 'Vue Dessus Parking',
  orbit_360: 'Vue Orbite 360°',
};

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: 'Matin Clair',
  afternoon: 'Plein Jour Naturel',
  sunset: 'Soleil Couchant',
  night: 'Nuit Autoroutière',
};

export const WEATHER_LABELS: Record<WeatherType, string> = {
  clear: 'Ciel Dégagé (Sec)',
  rain: 'Pluie & Route Mouillée',
  fog: 'Brouillard Dense',
  snow: 'Neige Alpine',
};

export const TRANSMISSION_LABELS: Record<TransmissionType, string> = {
  auto: 'Boîte Auto P-R-N-D',
  manual: 'Manuelle Séquentielle (M1-M6)',
};

export const TRAFFIC_DENSITY_LABELS: Record<TrafficDensity, string> = {
  off: 'Aucun',
  light: 'Fluide',
  dense: 'Dense',
};

export const DRIVING_STYLE_LABELS: Record<DrivingStyle, string> = {
  grip: 'Adhérence GT',
  balanced: 'Équilibré Sport',
  drift: 'Mode Drift Pro',
};

export const ENGINE_SWAP_OPTIONS: Array<{
  id: EngineSwapType;
  name: string;
  subtitle: string;
  hpBonus: number;
  nmBonus: number;
  speedBonus: number;
  accelBonus: number;
}> = [
  {
    id: 'stock',
    name: 'Bloc Moteur Série (Origine)',
    subtitle: 'Motorisation constructeur d’origine équilibrée',
    hpBonus: 0,
    nmBonus: 0,
    speedBonus: 0,
    accelBonus: 0,
  },
  {
    id: 'v6_35',
    name: 'Swap V6 3.5L Bi-Turbo JDM',
    subtitle: 'Montée en régime rapide et couple réactif dès 2 500 tr/min',
    hpBonus: 110,
    nmBonus: 140,
    speedBonus: 0.04,
    accelBonus: 0.08,
  },
  {
    id: 'v8_40_biturbo',
    name: 'Swap V8 4.0L BiTurbo AMG',
    subtitle: 'V8 forgé haute pression à vilebrequin plat et sonorité grave',
    hpBonus: 240,
    nmBonus: 310,
    speedBonus: 0.09,
    accelBonus: 0.14,
  },
  {
    id: 'v10_52',
    name: 'Swap V10 5.2L Atmosphérique Course',
    subtitle: 'Zone rouge à 8 500 tr/min et puissance pure sur autoroute',
    hpBonus: 360,
    nmBonus: 390,
    speedBonus: 0.14,
    accelBonus: 0.19,
  },
  {
    id: 'w16_80_quad',
    name: 'Swap W16 8.0L Quad-Turbo 1600 HP',
    subtitle: 'Préparation extrême Car Parking Multiplayer (16 cylindres, 4 turbos)',
    hpBonus: 580,
    nmBonus: 680,
    speedBonus: 0.22,
    accelBonus: 0.28,
  },
];

export const TIRE_SMOKE_SWATCHES = [
  { name: 'Fumée Blanche Classique', hex: '#f8fafc' },
  { name: 'Fumée Bleue Drift', hex: '#38bdf8' },
  { name: 'Fumée Rouge Compétition', hex: '#ef4444' },
  { name: 'Fumée Or Solaire', hex: '#facc15' },
  { name: 'Fumée Violette Show', hex: '#a855f7' },
  { name: 'Fumée Verte Monster', hex: '#22c55e' },
];

export const DEFAULT_UPGRADES: CarPerformanceUpgrades = {
  engineLevel: 1,
  turboLevel: 1,
  tiresLevel: 1,
  brakesLevel: 1,
  engineSwap: 'stock',
  ecuStage: 1,
  exhaustSport: false,
};

export function computeCarDynoStats(
  base: CarSpec,
  upgrades?: CarPerformanceUpgrades
): { hp: number; nm: number } {
  const u = upgrades || DEFAULT_UPGRADES;
  const baseHp = base.baseHp ?? Math.round(base.maxSpeedKmh * 2.1);
  const baseNm = base.baseNm ?? Math.round(base.acceleration * 19.5);
  const swap = ENGINE_SWAP_OPTIONS.find((s) => s.id === (u.engineSwap || 'stock')) || ENGINE_SWAP_OPTIONS[0];
  const engHp = (u.engineLevel - 1) * 65;
  const trbHp = (u.turboLevel - 1) * 95;
  const ecuHp = ((u.ecuStage ?? 1) - 1) * 45;
  const exhHp = u.exhaustSport ? 35 : 0;

  const hp = Math.min(1695, baseHp + swap.hpBonus + engHp + trbHp + ecuHp + exhHp);
  const nm = Math.min(2150, baseNm + swap.nmBonus + Math.round((engHp + trbHp + ecuHp) * 1.18));
  return { hp, nm };
}

export function getEffectiveCarSpec(base: CarSpec, upgrades?: CarPerformanceUpgrades): CarSpec {
  const u = upgrades || DEFAULT_UPGRADES;
  const swap = ENGINE_SWAP_OPTIONS.find((s) => s.id === (u.engineSwap || 'stock')) || ENGINE_SWAP_OPTIONS[0];
  const engBonus = (u.engineLevel - 1) * 0.06 + swap.speedBonus;
  const trbBonus = (u.turboLevel - 1) * 0.09 + swap.accelBonus + ((u.ecuStage ?? 1) - 1) * 0.04;
  const tirBonus = (u.tiresLevel - 1) * 0.08;
  const brkBonus = (u.brakesLevel - 1) * 0.09;

  return {
    ...base,
    maxSpeedKmh: Math.round(base.maxSpeedKmh * (1 + engBonus + trbBonus * 0.25)),
    acceleration: Number((base.acceleration * (1 + trbBonus + engBonus * 0.3)).toFixed(1)),
    handling: Number((base.handling * (1 + tirBonus)).toFixed(2)),
    braking: Number((base.braking * (1 + brkBonus)).toFixed(1)),
    stats: {
      speed: Math.min(100, Math.round(base.stats.speed + (u.engineLevel - 1) * 5 + (u.turboLevel - 1) * 2 + swap.speedBonus * 45)),
      accel: Math.min(100, Math.round(base.stats.accel + (u.turboLevel - 1) * 5 + (u.engineLevel - 1) * 2 + swap.accelBonus * 40)),
      handling: Math.min(100, Math.round(base.stats.handling + (u.tiresLevel - 1) * 6)),
      braking: Math.min(100, Math.round(base.stats.braking + (u.brakesLevel - 1) * 6)),
    },
  };
}

export const CARS: CarSpec[] = [
  {
    id: 'mercedes-amg-gt',
    name: 'Mercedes-AMG GT V8 BiTurbo',
    category: 'Supercar V8 BiTurbo GT',
    tagline: 'V8 4.0L BiTurbo grondant de 730 ch, calandre Panamericana chromée avec étoile Mercedes, échappement sport actif AMG rugissant.',
    maxSpeedKmh: 342,
    acceleration: 42,
    handling: 3.15,
    braking: 56,
    baseHp: 730,
    baseNm: 850,
    defaultColor: '#475569',
    defaultRimColor: '#0f172a',
    bodyStyle: 'gt',
    stats: { speed: 95, accel: 94, handling: 92, braking: 93 },
  },
  {
    id: 'vortex-rs',
    name: 'Civic EK-R Turbo',
    category: 'Coupé Sport & Street Tuner',
    tagline: 'Châssis large préparé, habitacle sport rouge visible, carrosserie vernie et échappement inox.',
    maxSpeedKmh: 295,
    acceleration: 39,
    handling: 3.2,
    braking: 54,
    baseHp: 410,
    baseNm: 520,
    defaultColor: '#1d4ed8',
    defaultRimColor: '#cbd5e1',
    bodyStyle: 'street',
    stats: { speed: 85, accel: 91, handling: 92, braking: 89 },
  },
  {
    id: 'apex-gt',
    name: 'Apex V12 GT',
    category: 'Grand Tourisme',
    tagline: 'Carrosserie fastback sculptée alliant vitesse de pointe et équilibre aérodynamique.',
    maxSpeedKmh: 325,
    acceleration: 37,
    handling: 2.85,
    braking: 50,
    baseHp: 680,
    baseNm: 760,
    defaultColor: '#dc2626',
    defaultRimColor: '#e2e8f0',
    bodyStyle: 'gt',
    stats: { speed: 90, accel: 86, handling: 88, braking: 88 },
  },
  {
    id: 'chronos-hyper',
    name: 'Chronos Hyperion',
    category: 'Hypercar Prototype',
    tagline: 'Aérodynamique active à effet de sol et V10 hybride de 1 180 ch.',
    maxSpeedKmh: 360,
    acceleration: 43,
    handling: 2.75,
    braking: 53,
    baseHp: 980,
    baseNm: 1120,
    defaultColor: '#0284c7',
    defaultRimColor: '#0f172a',
    bodyStyle: 'hyper',
    stats: { speed: 95, accel: 93, handling: 87, braking: 90 },
  },
  {
    id: 'titan-gtr',
    name: 'Titan GTR-X',
    category: 'Track Muscle Widebody',
    tagline: 'Ailes élargies, capot ventilé et couple massif pour dominer les lignes droites.',
    maxSpeedKmh: 335,
    acceleration: 38,
    handling: 2.65,
    braking: 48,
    baseHp: 790,
    baseNm: 980,
    defaultColor: '#f8fafc',
    defaultRimColor: '#d4af37',
    bodyStyle: 'muscle',
    stats: { speed: 91, accel: 89, handling: 84, braking: 85 },
  },
];

export const PAINT_SWATCHES = [
  { name: 'Noir Onyx Brillant', hex: '#14171c' },
  { name: 'Rouge Corsa Métal', hex: '#dc2626' },
  { name: 'Bleu Alpine Nacré', hex: '#0284c7' },
  { name: 'Blanc Championship', hex: '#f8fafc' },
  { name: 'Or Solaire AMG', hex: '#f59e0b' },
  { name: 'Vert Émeraude GT', hex: '#059669' },
  { name: 'Gris Sélénite Magno', hex: '#475569' },
  { name: 'Violet Midnight', hex: '#7c3aed' },
  { name: 'Orange Papaya McLaren', hex: '#f97316' },
  { name: 'Cyan Miami Vice', hex: '#06b6d4' },
];

export const RIM_SWATCHES = [
  { name: 'Alliage Argent Poli', hex: '#cbd5e1' },
  { name: 'Carbone Forgé Noir', hex: '#18181b' },
  { name: 'Or Bronze JDM', hex: '#d4af37' },
  { name: 'Bronze Compétition', hex: '#a16207' },
  { name: 'Titane Gunmetal', hex: '#475569' },
  { name: 'Blanc Rallye', hex: '#f8fafc' },
];

export const RIM_STYLE_OPTIONS: Array<{
  id: RimStyle;
  name: string;
  subtitle: string;
}> = [
  {
    id: 'amg_multi',
    name: 'AMG 10-Branches Forgées',
    subtitle: 'Doubles branches fines forgées avec écrou central compétition',
  },
  {
    id: 'gt_five_spoke',
    name: 'Étoile GT 5-Branches',
    subtitle: '5 branches larges concaves haute rigidité style Grand Tourisme',
  },
  {
    id: 'bbs_mesh',
    name: 'BBS Motorsport Y-Mesh',
    subtitle: 'Maillage croisé en Y avec rivets périphériques chromés',
  },
  {
    id: 'aero_turbine',
    name: 'Aéro Turbine Carbone',
    subtitle: '12 ailettes directionnelles ventilées à flasque aérodynamique',
  },
];

export const BODY_KIT_OPTIONS: Array<{
  id: BodyKitType;
  name: string;
  subtitle: string;
  aeroBonusText: string;
}> = [
  {
    id: 'stock',
    name: 'Série Usine (Origine)',
    subtitle: 'Ligne pure du constructeur avec aérodynamique d’origine',
    aeroBonusText: 'Équilibre standard',
  },
  {
    id: 'sport_aero',
    name: 'Pack Aéro Sport Carbone',
    subtitle: 'Lame avant carbone à tirants, canards latéraux, bas de caisse profilés & becquet ducktail',
    aeroBonusText: '+Appui Aéro Sport',
  },
  {
    id: 'gt3_widebody',
    name: 'Kit Large GT3 Compétition',
    subtitle: 'Ailes élargies rivetées (+16 cm), écope de toit, diffuseur 7 dérives & aileron GT3 col-de-cygne',
    aeroBonusText: '+Appui Max GT3 Widebody',
  },
];

export const HEADLIGHT_SWATCHES = [
  { name: 'LED Blanc Pur 6000K', hex: '#ffffff' },
  { name: 'Xénon Bleu Glace', hex: '#7dd3fc' },
  { name: 'Halogène Jaune GT', hex: '#fde047' },
  { name: 'Laser Ambre Course', hex: '#fb923c' },
];

import { LEVELS } from '../engine/levels';

export { LEVELS };
export const TRACKS: TrackSpec[] = LEVELS;
